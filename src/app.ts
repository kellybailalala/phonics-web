import express, { Request, Response } from "express";
import path from "node:path";
import {
  children,
  consents,
  deletionRequests,
  emptyProgress,
  nextId,
  normalizeLoginKey,
  parents,
  parentsByLoginKey,
  placementFromAge,
  resetStore,
  sessions,
  trackLessonKey,
  updateMilestones,
  lessonsByDate
} from "./store";
import { getEvents, logEvent, resetAnalytics } from "./analytics";
import { AVATAR_IDS } from "./content";
import { ChildProfile, ParentAuthResponse, Reward } from "./contracts";
import { createDailyLesson, dateKey } from "./lesson";

interface AuthenticatedRequest extends Request {
  parentId?: string;
}

const tokenStore = new Map<string, string>();

function parseBearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function authOr401(req: AuthenticatedRequest, res: Response): string | null {
  const token = parseBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing bearer token." });
    return null;
  }

  const parentId = tokenStore.get(token);
  if (!parentId || !parents.has(parentId)) {
    res.status(401).json({ error: "Invalid token." });
    return null;
  }

  req.parentId = parentId;
  return parentId;
}

function issueAuth(parentId: string): ParentAuthResponse {
  const token = `tok_${nextId("auth")}`;
  tokenStore.set(token, parentId);
  return { parentId, token };
}

export function resetAppState(): void {
  tokenStore.clear();
  resetStore();
  resetAnalytics();
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, now: new Date().toISOString() });
  });

  app.post("/api/v1/parent/signup", (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : undefined;
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : undefined;

    const loginKey = normalizeLoginKey(email, phone);
    if (!loginKey) {
      res.status(400).json({ error: "Provide email or phone." });
      return;
    }

    let parentId = parentsByLoginKey.get(loginKey);
    if (!parentId) {
      parentId = nextId("parent");
      parents.set(parentId, {
        id: parentId,
        email,
        phone,
        createdAt: new Date().toISOString()
      });
      parentsByLoginKey.set(loginKey, parentId);
    }

    const auth = issueAuth(parentId);
    logEvent("parent_signup_completed", { parentId });

    res.status(201).json(auth);
  });

  app.post("/api/v1/parent/login", (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : undefined;
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : undefined;

    const loginKey = normalizeLoginKey(email, phone);
    if (!loginKey) {
      res.status(400).json({ error: "Provide email or phone." });
      return;
    }

    const parentId = parentsByLoginKey.get(loginKey);
    if (!parentId) {
      res.status(404).json({ error: "Parent account not found." });
      return;
    }

    res.json(issueAuth(parentId));
  });

  app.post("/api/v1/consent", (req: AuthenticatedRequest, res) => {
    const parentId = authOr401(req, res);
    if (!parentId) {
      return;
    }

    const accepted = req.body?.accepted === true;
    const market = typeof req.body?.market === "string" ? req.body.market : "Singapore";
    if (!accepted) {
      res.status(400).json({ error: "Consent must be accepted to continue." });
      return;
    }

    const record = {
      parentId,
      accepted: true,
      market,
      acceptedAt: new Date().toISOString()
    };

    consents.set(parentId, record);
    logEvent("consent_accepted", { parentId, metadata: { market } });
    res.status(201).json(record);
  });

  app.post("/api/v1/children", (req: AuthenticatedRequest, res) => {
    const parentId = authOr401(req, res);
    if (!parentId) {
      return;
    }

    if (!consents.get(parentId)?.accepted) {
      res.status(403).json({ error: "Parent consent is required before creating a child profile." });
      return;
    }

    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
    const ageMonths = Number(req.body?.ageMonths);
    const homeLanguage = typeof req.body?.homeLanguage === "string" ? req.body.homeLanguage.trim() : "";
    const avatarId = typeof req.body?.avatarId === "string" ? req.body.avatarId.trim() : AVATAR_IDS[0];

    if (!displayName) {
      res.status(400).json({ error: "displayName is required." });
      return;
    }

    if (!Number.isFinite(ageMonths) || ageMonths < 36 || ageMonths > 71) {
      res.status(400).json({ error: "ageMonths must be between 36 and 71." });
      return;
    }

    if (!homeLanguage) {
      res.status(400).json({ error: "homeLanguage is required." });
      return;
    }

    const childId = nextId("child");
    const child: ChildProfile = {
      id: childId,
      displayName,
      ageMonths,
      homeLanguage,
      avatarId: AVATAR_IDS.includes(avatarId) ? avatarId : AVATAR_IDS[0],
      placementTrack: placementFromAge(ageMonths),
      createdAt: new Date().toISOString()
    };

    children.set(childId, {
      ...child,
      parentId,
      rewards: [],
      progress: emptyProgress(childId),
      completedUnitIds: new Set<string>()
    });

    logEvent("child_profile_created", { parentId, childId, metadata: { ageMonths, homeLanguage } });
    logEvent("placement_completed", { parentId, childId, metadata: { placementTrack: child.placementTrack } });

    res.status(201).json(child);
  });

  app.get("/api/v1/children/:childId/lesson/today", (req: AuthenticatedRequest, res) => {
    const parentId = authOr401(req, res);
    if (!parentId) {
      return;
    }

    const child = children.get(req.params.childId);
    if (!child || child.parentId !== parentId) {
      res.status(404).json({ error: "Child not found." });
      return;
    }

    const key = trackLessonKey(child.id, dateKey());
    let lesson = lessonsByDate.get(key);
    if (!lesson) {
      lesson = createDailyLesson(child);
      lessonsByDate.set(key, lesson);
    }

    res.json(lesson);
  });

  app.post("/api/v1/children/:childId/session/start", (req: AuthenticatedRequest, res) => {
    const parentId = authOr401(req, res);
    if (!parentId) {
      return;
    }

    const child = children.get(req.params.childId);
    if (!child || child.parentId !== parentId) {
      res.status(404).json({ error: "Child not found." });
      return;
    }

    const key = trackLessonKey(child.id, dateKey());
    const lesson = lessonsByDate.get(key) ?? createDailyLesson(child);
    lessonsByDate.set(key, lesson);

    const sessionId = nextId("session");
    sessions.set(sessionId, {
      id: sessionId,
      parentId,
      childId: child.id,
      lessonId: lesson.lessonId,
      startedAt: new Date().toISOString(),
      completedActivityIds: []
    });

    logEvent("lesson_started", {
      parentId,
      childId: child.id,
      metadata: { sessionId, lessonId: lesson.lessonId }
    });

    res.status(201).json({
      sessionId,
      lessonId: lesson.lessonId,
      activities: lesson.activities
    });
  });

  app.post("/api/v1/children/:childId/session/complete", (req: AuthenticatedRequest, res) => {
    const parentId = authOr401(req, res);
    if (!parentId) {
      return;
    }

    const child = children.get(req.params.childId);
    if (!child || child.parentId !== parentId) {
      res.status(404).json({ error: "Child not found." });
      return;
    }

    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
    const session = sessions.get(sessionId);
    if (!session || session.parentId !== parentId || session.childId !== child.id) {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    if (session.completedAt && session.reward) {
      res.json({
        sessionId: session.id,
        completedAt: session.completedAt,
        reward: session.reward,
        idempotent: true
      });
      return;
    }

    const completedActivityIds = Array.isArray(req.body?.completedActivityIds)
      ? req.body.completedActivityIds.filter((item: unknown): item is string => typeof item === "string")
      : [];

    session.completedActivityIds = completedActivityIds;
    session.completedAt = new Date().toISOString();

    const reward: Reward = {
      id: nextId("reward"),
      type: "sticker",
      label: "Shiny Star",
      earnedAt: session.completedAt
    };
    session.reward = reward;

    child.rewards.push(reward);
    child.progress.sessionsCompleted += 1;
    child.progress.lastActiveAt = session.completedAt;

    const todayLesson = lessonsByDate.get(trackLessonKey(child.id, dateKey()));
    if (todayLesson) {
      child.completedUnitIds.add(todayLesson.unitId);
    }

    child.progress.unitsCompleted = child.completedUnitIds.size;
    child.progress = updateMilestones(child.progress);

    for (const activityId of completedActivityIds) {
      logEvent("activity_completed", {
        parentId,
        childId: child.id,
        metadata: { sessionId: session.id, activityId }
      });
    }

    logEvent("lesson_completed", {
      parentId,
      childId: child.id,
      metadata: { sessionId: session.id, lessonId: session.lessonId }
    });
    logEvent("reward_earned", {
      parentId,
      childId: child.id,
      metadata: { rewardId: reward.id, rewardType: reward.type }
    });

    res.json({
      sessionId: session.id,
      completedAt: session.completedAt,
      reward,
      progress: child.progress
    });
  });

  app.get("/api/v1/children/:childId/progress", (req: AuthenticatedRequest, res) => {
    const parentId = authOr401(req, res);
    if (!parentId) {
      return;
    }

    const child = children.get(req.params.childId);
    if (!child || child.parentId !== parentId) {
      res.status(404).json({ error: "Child not found." });
      return;
    }

    logEvent("dashboard_viewed", { parentId, childId: child.id });
    res.json({
      ...child.progress,
      rewards: child.rewards.slice(-5)
    });
  });

  app.post("/api/v1/children/:childId/data-deletion-request", (req: AuthenticatedRequest, res) => {
    const parentId = authOr401(req, res);
    if (!parentId) {
      return;
    }

    const child = children.get(req.params.childId);
    if (!child || child.parentId !== parentId) {
      res.status(404).json({ error: "Child not found." });
      return;
    }

    const requestId = nextId("del");
    const job = {
      id: requestId,
      childId: child.id,
      parentId,
      status: "queued" as const,
      requestedAt: new Date().toISOString()
    };

    deletionRequests.push(job);
    logEvent("deletion_requested", {
      parentId,
      childId: child.id,
      metadata: { requestId: job.id }
    });

    res.status(202).json(job);
  });

  app.get("/api/v1/analytics/events", (_req, res) => {
    res.json(getEvents());
  });

  app.use(express.static(path.join(process.cwd(), "src/public")));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(process.cwd(), "src/public/index.html"));
  });

  return app;
}
