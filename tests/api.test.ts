import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp, resetAppState } from "../src/app";

type Agent = ReturnType<typeof request>;

async function signup(agent: Agent, identity: string) {
  const payload = identity.includes("@") ? { email: identity } : { phone: identity };
  const response = await agent.post("/api/v1/parent/signup").send(payload).expect(201);
  return response.body as { parentId: string; token: string };
}

async function consent(agent: Agent, token: string) {
  await agent
    .post("/api/v1/consent")
    .set("authorization", `Bearer ${token}`)
    .send({ accepted: true, market: "Singapore" })
    .expect(201);
}

test.beforeEach(() => {
  resetAppState();
});

test("consent is required and placement tracks map by age", async () => {
  const agent = request(createApp());
  const { token } = await signup(agent, "parent1@example.com");

  await agent
    .post("/api/v1/children")
    .set("authorization", `Bearer ${token}`)
    .send({ displayName: "Ari", ageMonths: 48, homeLanguage: "Mandarin", avatarId: "tiger" })
    .expect(403);

  await consent(agent, token);

  const childA = await agent
    .post("/api/v1/children")
    .set("authorization", `Bearer ${token}`)
    .send({ displayName: "Mia", ageMonths: 36, homeLanguage: "Mandarin", avatarId: "rocket" })
    .expect(201);
  assert.equal(childA.body.placementTrack, "starter_a");

  const childB = await agent
    .post("/api/v1/children")
    .set("authorization", `Bearer ${token}`)
    .send({ displayName: "Noah", ageMonths: 48, homeLanguage: "Malay", avatarId: "whale" })
    .expect(201);
  assert.equal(childB.body.placementTrack, "starter_b");

  const childC = await agent
    .post("/api/v1/children")
    .set("authorization", `Bearer ${token}`)
    .send({ displayName: "Lina", ageMonths: 60, homeLanguage: "Tamil", avatarId: "koala" })
    .expect(201);
  assert.equal(childC.body.placementTrack, "starter_c");
});

test("daily lesson, session completion, and idempotency", async () => {
  const agent = request(createApp());
  const { token } = await signup(agent, "parent2@example.com");
  await consent(agent, token);

  const child = await agent
    .post("/api/v1/children")
    .set("authorization", `Bearer ${token}`)
    .send({ displayName: "Kai", ageMonths: 50, homeLanguage: "Mandarin", avatarId: "panda" })
    .expect(201);

  const lesson = await agent
    .get(`/api/v1/children/${child.body.id}/lesson/today`)
    .set("authorization", `Bearer ${token}`)
    .expect(200);

  assert.equal(lesson.body.activities.length, 5);
  assert.ok(lesson.body.activities.every((activity: { promptAudioUrl: string }) => activity.promptAudioUrl.startsWith("speech:")));

  const start = await agent
    .post(`/api/v1/children/${child.body.id}/session/start`)
    .set("authorization", `Bearer ${token}`)
    .send({})
    .expect(201);

  const activityIds = start.body.activities.map((activity: { id: string }) => activity.id);

  const complete = await agent
    .post(`/api/v1/children/${child.body.id}/session/complete`)
    .set("authorization", `Bearer ${token}`)
    .send({ sessionId: start.body.sessionId, completedActivityIds: activityIds })
    .expect(200);

  assert.equal(complete.body.reward.type, "sticker");
  assert.equal(complete.body.progress.sessionsCompleted, 1);

  const completeAgain = await agent
    .post(`/api/v1/children/${child.body.id}/session/complete`)
    .set("authorization", `Bearer ${token}`)
    .send({ sessionId: start.body.sessionId, completedActivityIds: activityIds })
    .expect(200);

  assert.equal(completeAgain.body.idempotent, true);

  const progress = await agent
    .get(`/api/v1/children/${child.body.id}/progress`)
    .set("authorization", `Bearer ${token}`)
    .expect(200);

  assert.equal(progress.body.sessionsCompleted, 1);
  assert.equal(progress.body.unitsCompleted, 1);
});

test("unauthorized parent cannot read another child progress", async () => {
  const agent = request(createApp());

  const parentOne = await signup(agent, "alpha@example.com");
  await consent(agent, parentOne.token);

  const child = await agent
    .post("/api/v1/children")
    .set("authorization", `Bearer ${parentOne.token}`)
    .send({ displayName: "A", ageMonths: 49, homeLanguage: "Mandarin", avatarId: "rocket" })
    .expect(201);

  const parentTwo = await signup(agent, "beta@example.com");
  await consent(agent, parentTwo.token);

  await agent
    .get(`/api/v1/children/${child.body.id}/progress`)
    .set("authorization", `Bearer ${parentTwo.token}`)
    .expect(404);
});

test("data deletion request creates a queued job", async () => {
  const agent = request(createApp());

  const auth = await signup(agent, "delete-parent@example.com");
  await consent(agent, auth.token);

  const child = await agent
    .post("/api/v1/children")
    .set("authorization", `Bearer ${auth.token}`)
    .send({ displayName: "Luca", ageMonths: 58, homeLanguage: "Mandarin", avatarId: "owl" })
    .expect(201);

  const deletion = await agent
    .post(`/api/v1/children/${child.body.id}/data-deletion-request`)
    .set("authorization", `Bearer ${auth.token}`)
    .send({})
    .expect(202);

  assert.equal(deletion.body.status, "queued");
  assert.equal(deletion.body.childId, child.body.id);
});
