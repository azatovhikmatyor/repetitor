"""Testlar moduli: katalog/obuna, tayinlash, urinish, qo'lda baholash, reyting."""

import asyncio
import datetime as dt

from httpx import AsyncClient

from tests.conftest import add_student, approved_teacher, create_group

CATALOG_QUIZ_PAYLOAD = {
    "subject": "Ingliz tili",
    "title": "Grammar Quiz 1",
    "sections": [
        {
            "title": "Grammar",
            "questions": [
                {
                    "type": "single_choice",
                    "prompt": "She ___ to school every day.",
                    "options": [{"id": "a", "text": "go"}, {"id": "b", "text": "goes"}],
                    "correct_answer": "b",
                    "points": 5,
                },
                {
                    "type": "text",
                    "prompt": "Opposite of 'hot'?",
                    "correct_answer": "cold",
                    "points": 3,
                },
            ],
        }
    ],
}

ESSAY_QUIZ_PAYLOAD = {
    "subject": "Ingliz tili",
    "title": "Writing Task",
    "sections": [
        {
            "title": "Writing",
            "questions": [
                {
                    "type": "essay",
                    "prompt": "Write about your city.",
                    "points": 10,
                }
            ],
        }
    ],
}


async def _student_login(client: AsyncClient, temp_password: str, phone: str) -> dict:
    login = await client.post(
        "/auth/login", json={"login": phone, "password": temp_password}
    )
    assert login.status_code == 200, login.text
    body = login.json()
    student_headers = {"Authorization": f"Bearer {body['access_token']}"}
    changed = await client.post(
        "/auth/password/change",
        json={
            "current_password": temp_password,
            "new_password": "yangiparol1",
            "new_password_confirm": "yangiparol1",
        },
        headers=student_headers,
    )
    assert changed.status_code == 200
    return student_headers


async def test_admin_catalog_quiz_requires_subscription(
    client: AsyncClient, admin_headers: dict
) -> None:
    teacher_headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, teacher_headers)

    created = await client.post(
        "/admin/quizzes", json=CATALOG_QUIZ_PAYLOAD, headers=admin_headers
    )
    assert created.status_code == 201, created.text
    quiz_id = created.json()["id"]

    catalog = await client.get("/quizzes/catalog", headers=teacher_headers)
    assert catalog.json()["total"] == 1
    assert catalog.json()["items"][0]["is_subscribed"] is False

    # Obunasiz tayinlashga urinish — begona resurs sifatida 404.
    unsubscribed_assign = await client.post(
        "/quizzes/assignments",
        json={
            "quiz_id": quiz_id,
            "group_id": group["id"],
            "mode": "practice",
        },
        headers=teacher_headers,
    )
    assert unsubscribed_assign.status_code == 404

    subscribed = await client.post(
        f"/quizzes/{quiz_id}/subscribe", headers=teacher_headers
    )
    assert subscribed.status_code == 200

    now_usable = await client.post(
        "/quizzes/assignments",
        json={"quiz_id": quiz_id, "group_id": group["id"], "mode": "practice"},
        headers=teacher_headers,
    )
    assert now_usable.status_code == 201, now_usable.text


async def test_teacher_creates_own_quiz_without_subscription(
    client: AsyncClient, admin_headers: dict
) -> None:
    teacher_headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, teacher_headers)

    created = await client.post(
        "/quizzes", json=CATALOG_QUIZ_PAYLOAD, headers=teacher_headers
    )
    assert created.status_code == 201, created.text
    quiz_id = created.json()["id"]

    assignment = await client.post(
        "/quizzes/assignments",
        json={"quiz_id": quiz_id, "group_id": group["id"], "mode": "practice"},
        headers=teacher_headers,
    )
    assert assignment.status_code == 201, assignment.text


async def test_exam_requires_deadline_and_max_attempts(
    client: AsyncClient, admin_headers: dict
) -> None:
    teacher_headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, teacher_headers)
    quiz_id = (
        await client.post(
            "/quizzes", json=CATALOG_QUIZ_PAYLOAD, headers=teacher_headers
        )
    ).json()["id"]

    response = await client.post(
        "/quizzes/assignments",
        json={"quiz_id": quiz_id, "group_id": group["id"], "mode": "exam"},
        headers=teacher_headers,
    )
    assert response.status_code == 422


async def test_practice_attempt_auto_grades_and_allows_multiple_tries(
    client: AsyncClient, admin_headers: dict
) -> None:
    teacher_headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, teacher_headers)
    created = await add_student(
        client, teacher_headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    student_headers = await _student_login(
        client, created["temporary_password"], "+998901112233"
    )

    quiz_id = (
        await client.post(
            "/quizzes", json=CATALOG_QUIZ_PAYLOAD, headers=teacher_headers
        )
    ).json()["id"]
    assignment_id = (
        await client.post(
            "/quizzes/assignments",
            json={"quiz_id": quiz_id, "group_id": group["id"], "mode": "practice"},
            headers=teacher_headers,
        )
    ).json()["id"]

    listed = await client.get(
        "/students/me/quizzes/assignments", headers=student_headers
    )
    assert listed.status_code == 200
    assert listed.json()[0]["mode"] == "practice"

    started = await client.post(
        f"/students/me/quizzes/assignments/{assignment_id}/start",
        headers=student_headers,
    )
    assert started.status_code == 201, started.text
    attempt = started.json()
    question_ids = [
        q["id"] for section in attempt["quiz"]["sections"] for q in section["questions"]
    ]

    submitted = await client.post(
        f"/students/me/quizzes/attempts/{attempt['attempt_id']}/submit",
        json={"answers": {str(question_ids[0]): "b", str(question_ids[1]): "cold"}},
        headers=student_headers,
    )
    assert submitted.status_code == 200, submitted.text
    result = submitted.json()
    assert result["status"] == "graded"
    assert result["total_score"] == 8
    assert result["max_score"] == 8

    # Practice — cheksiz urinish, yana boshlash mumkin.
    second = await client.post(
        f"/students/me/quizzes/assignments/{assignment_id}/start",
        headers=student_headers,
    )
    assert second.status_code == 201
    assert second.json()["attempt_no"] == 2

    history = await client.get("/students/me/quizzes/history", headers=student_headers)
    assert history.status_code == 200
    assert len(history.json()) == 2


async def test_exam_ranking_and_notifications_after_deadline(
    client: AsyncClient, admin_headers: dict, monkeypatch
) -> None:
    from app.modules.quizzes import service as quiz_service

    parent_calls: list[dict] = []
    teacher_calls: list[dict] = []

    async def fake_parent_notify(**kwargs):
        parent_calls.append(kwargs)

    async def fake_teacher_notify(**kwargs):
        teacher_calls.append(kwargs)

    monkeypatch.setattr(
        quiz_service, "notify_exam_result_to_parent", fake_parent_notify
    )
    monkeypatch.setattr(quiz_service, "notify_teacher_exam_ready", fake_teacher_notify)

    teacher_headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, teacher_headers)

    top = await add_student(
        client, teacher_headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    low = await add_student(
        client, teacher_headers, group["id"], first_name="Bekzod", phone="+998901112244"
    )
    top_headers = await _student_login(
        client, top["temporary_password"], "+998901112233"
    )
    low_headers = await _student_login(
        client, low["temporary_password"], "+998901112244"
    )

    # Ota-ona uchun link kodi olinadi (bot chetlab o'tib, faqat endpoint tekshiriladi).
    link_code = (
        await client.get("/students/me/quizzes/telegram-link-code", headers=top_headers)
    ).json()["link_code"]
    assert len(link_code) > 0

    quiz_id = (
        await client.post(
            "/quizzes", json=CATALOG_QUIZ_PAYLOAD, headers=teacher_headers
        )
    ).json()["id"]

    deadline = (dt.datetime.now(dt.UTC) + dt.timedelta(seconds=1)).isoformat()
    assignment_id = (
        await client.post(
            "/quizzes/assignments",
            json={
                "quiz_id": quiz_id,
                "group_id": group["id"],
                "mode": "exam",
                "max_attempts": 1,
                "score_rule": "best",
                "deadline": deadline,
            },
            headers=teacher_headers,
        )
    ).json()["id"]

    async def _attempt_and_submit(headers, answers):
        started = (
            await client.post(
                f"/students/me/quizzes/assignments/{assignment_id}/start",
                headers=headers,
            )
        ).json()
        question_ids = [
            q["id"]
            for section in started["quiz"]["sections"]
            for q in section["questions"]
        ]
        return await client.post(
            f"/students/me/quizzes/attempts/{started['attempt_id']}/submit",
            json={
                "answers": dict(
                    zip((str(i) for i in question_ids), answers, strict=False)
                )
            },
            headers=headers,
        )

    top_result = await _attempt_and_submit(top_headers, ["b", "cold"])
    assert top_result.json()["total_score"] == 8
    low_result = await _attempt_and_submit(low_headers, ["a", "hot"])
    assert low_result.json()["total_score"] == 0

    # Muddat o'tishini kutamiz (1 soniyaga o'rnatilgan).
    await asyncio.sleep(1.2)

    finalize = await client.post(
        f"/quizzes/assignments/{assignment_id}/finalize", headers=teacher_headers
    )
    assert finalize.status_code == 200, finalize.text
    results = finalize.json()
    assert results["fully_graded"] is True
    ranking = {entry["student_id"]: entry["rank"] for entry in results["entries"]}
    top_student_id = top["student"]["student"]["id"]
    low_student_id = low["student"]["student"]["id"]
    assert ranking[top_student_id] == 1
    assert ranking[low_student_id] == 2

    assert len(teacher_calls) == 1
    assert teacher_calls[0]["participant_count"] == 2
    # Bog'lanmagan ota-onaga xabar ketmaydi (parent_calls bo'sh bo'lishi mumkin,
    # chunki link_code faqat olindi, hech qachon botga yuborilmadi).
    assert parent_calls == []


async def test_essay_question_blocks_finalize_until_manually_graded(
    client: AsyncClient, admin_headers: dict, monkeypatch
) -> None:
    from app.modules.quizzes import service as quiz_service

    calls: list[dict] = []

    async def fake_teacher_notify(**kwargs):
        calls.append(kwargs)

    async def fake_parent_notify(**kwargs):
        return None

    monkeypatch.setattr(quiz_service, "notify_teacher_exam_ready", fake_teacher_notify)
    monkeypatch.setattr(
        quiz_service, "notify_exam_result_to_parent", fake_parent_notify
    )

    teacher_headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, teacher_headers)
    created = await add_student(
        client, teacher_headers, group["id"], first_name="Aziza", phone="+998901112233"
    )
    student_headers = await _student_login(
        client, created["temporary_password"], "+998901112233"
    )

    quiz_id = (
        await client.post("/quizzes", json=ESSAY_QUIZ_PAYLOAD, headers=teacher_headers)
    ).json()["id"]

    deadline = (dt.datetime.now(dt.UTC) + dt.timedelta(seconds=1)).isoformat()
    assignment_id = (
        await client.post(
            "/quizzes/assignments",
            json={
                "quiz_id": quiz_id,
                "group_id": group["id"],
                "mode": "exam",
                "max_attempts": 1,
                "deadline": deadline,
            },
            headers=teacher_headers,
        )
    ).json()["id"]

    started = (
        await client.post(
            f"/students/me/quizzes/assignments/{assignment_id}/start",
            headers=student_headers,
        )
    ).json()
    question_id = started["quiz"]["sections"][0]["questions"][0]["id"]

    submitted = await client.post(
        f"/students/me/quizzes/attempts/{started['attempt_id']}/submit",
        json={"answers": {str(question_id): "My city is beautiful."}},
        headers=student_headers,
    )
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "submitted"
    assert submitted.json()["pending_manual_grading"] is True

    await asyncio.sleep(1.2)

    too_early = await client.post(
        f"/quizzes/assignments/{assignment_id}/finalize", headers=teacher_headers
    )
    assert too_early.json()["fully_graded"] is False
    assert calls == []

    pending = await client.get(
        f"/quizzes/assignments/{assignment_id}/pending-grading", headers=teacher_headers
    )
    assert pending.status_code == 200
    pending_body = pending.json()
    assert len(pending_body) == 1
    attempt_id = pending_body[0]["attempt_id"]

    graded = await client.post(
        f"/quizzes/attempts/{attempt_id}/grade",
        json={
            "grades": [{"question_id": question_id, "score": 7, "feedback": "Yaxshi"}]
        },
        headers=teacher_headers,
    )
    assert graded.status_code == 200, graded.text
    assert graded.json()["status"] == "graded"
    assert graded.json()["total_score"] == 7

    finalized = await client.post(
        f"/quizzes/assignments/{assignment_id}/finalize", headers=teacher_headers
    )
    assert finalized.json()["fully_graded"] is True
    assert len(calls) == 1


async def test_update_quiz_top_level_fields(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Test sarlavhasi, izohi va boshqa yuqori darajali maydonlarini tahrirlash."""
    teacher_headers, _ = await approved_teacher(client, admin_headers)

    created = await client.post(
        "/quizzes", json=CATALOG_QUIZ_PAYLOAD, headers=teacher_headers
    )
    assert created.status_code == 201
    quiz_id = created.json()["id"]

    updated = await client.put(
        f"/quizzes/{quiz_id}",
        json={
            "subject": "Matematika",
            "title": "Algebra asoslari",
            "description": "Yangi izoh",
            "time_limit_minutes": 30,
            "sections": [
                {
                    "title": "Algebra",
                    "questions": [
                        {
                            "type": "text",
                            "prompt": "2+2=?",
                            "correct_answer": "4",
                            "points": 2,
                        }
                    ],
                }
            ],
        },
        headers=teacher_headers,
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["subject"] == "Matematika"
    assert body["title"] == "Algebra asoslari"
    assert body["description"] == "Yangi izoh"
    assert body["time_limit_minutes"] == 30
    assert len(body["sections"]) == 1
    assert len(body["sections"][0]["questions"]) == 1


async def test_cannot_update_assigned_quiz(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Tayinlangan testni tahrirlab bo'lmaydi."""
    teacher_headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, teacher_headers)

    created = await client.post(
        "/quizzes", json=CATALOG_QUIZ_PAYLOAD, headers=teacher_headers
    )
    quiz_id = created.json()["id"]

    await client.post(
        "/quizzes/assignments",
        json={"quiz_id": quiz_id, "group_id": group["id"], "mode": "practice"},
        headers=teacher_headers,
    )

    q_text = {"type": "text", "prompt": "?", "correct_answer": "x", "points": 1}
    updated = await client.put(
        f"/quizzes/{quiz_id}",
        json={
            "subject": "Fan",
            "title": "Test",
            "sections": [{"title": "S", "questions": [q_text]}],
        },
        headers=teacher_headers,
    )
    assert updated.status_code == 409


async def test_delete_quiz_without_assignments(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Tayinlanmagan test o'chiriladi."""
    teacher_headers, _ = await approved_teacher(client, admin_headers)

    created = await client.post(
        "/quizzes", json=CATALOG_QUIZ_PAYLOAD, headers=teacher_headers
    )
    quiz_id = created.json()["id"]

    response = await client.delete(f"/quizzes/{quiz_id}", headers=teacher_headers)
    assert response.status_code == 204

    gone = await client.get(f"/quizzes/{quiz_id}", headers=teacher_headers)
    assert gone.status_code == 404


async def test_cannot_delete_assigned_quiz(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Tayinlangan testni o'chirib bo'lmaydi."""
    teacher_headers, _ = await approved_teacher(client, admin_headers)
    group = await create_group(client, teacher_headers)

    created = await client.post(
        "/quizzes", json=CATALOG_QUIZ_PAYLOAD, headers=teacher_headers
    )
    quiz_id = created.json()["id"]

    await client.post(
        "/quizzes/assignments",
        json={"quiz_id": quiz_id, "group_id": group["id"], "mode": "practice"},
        headers=teacher_headers,
    )

    response = await client.delete(f"/quizzes/{quiz_id}", headers=teacher_headers)
    assert response.status_code == 409


async def test_clone_quiz_deep_copies_sections(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Test nusxasi barcha bo'lim va savollar bilan yaratiladi."""
    teacher_headers, _ = await approved_teacher(client, admin_headers)

    created = await client.post(
        "/quizzes", json=CATALOG_QUIZ_PAYLOAD, headers=teacher_headers
    )
    quiz_id = created.json()["id"]

    cloned = await client.post(
        f"/quizzes/{quiz_id}/clone", headers=teacher_headers
    )
    assert cloned.status_code == 201, cloned.text
    body = cloned.json()
    assert body["id"] != quiz_id
    assert "nusxa" in body["title"]
    assert body["is_catalog"] is False
    assert body["subject"] == "Ingliz tili"
    assert len(body["sections"]) == 1
    assert len(body["sections"][0]["questions"]) == 2


async def test_cannot_edit_other_teachers_quiz(
    client: AsyncClient, admin_headers: dict
) -> None:
    """Boshqa o'qituvchining testini tahrirlab bo'lmaydi."""
    t1_headers, _ = await approved_teacher(
        client, admin_headers, username="bob", phone="+998901110001"
    )
    t2_headers, _ = await approved_teacher(
        client, admin_headers, username="anna", phone="+998901110002"
    )

    created = await client.post(
        "/quizzes", json=CATALOG_QUIZ_PAYLOAD, headers=t1_headers
    )
    quiz_id = created.json()["id"]

    # Boshqa o'qituvchi tahrirlay olmaydi (404, mavjudligi ham ko'rinmasin)
    q_text = {"type": "text", "prompt": "?", "correct_answer": "x", "points": 1}
    updated = await client.put(
        f"/quizzes/{quiz_id}",
        json={
            "subject": "X",
            "title": "Y",
            "sections": [{"title": "Z", "questions": [q_text]}],
        },
        headers=t2_headers,
    )
    assert updated.status_code == 404
