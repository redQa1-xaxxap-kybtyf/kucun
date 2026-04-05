import type { NextRequest, NextResponse } from 'next/server';

const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const MAX_TRACKED_IDS = 80;

type FallbackCookieKind = 'read' | 'hidden';

function sanitizeUserId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getCookieName(kind: FallbackCookieKind, userId: string): string {
  return `fb_notifications_${kind}_${sanitizeUserId(userId)}`;
}

function parseIdSet(rawValue?: string): Set<string> {
  if (!rawValue) {
    return new Set<string>();
  }

  return new Set(
    rawValue
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
      .slice(-MAX_TRACKED_IDS)
  );
}

function serializeIdSet(ids: Set<string>): string {
  return Array.from(ids).slice(-MAX_TRACKED_IDS).join(',');
}

function writeCookie(
  response: NextResponse,
  name: string,
  ids: Set<string>
): void {
  if (ids.size === 0) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
    return;
  }

  response.cookies.set(name, serializeIdSet(ids), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export function getFallbackNotificationState(
  request: NextRequest,
  userId: string
): {
  hiddenIds: Set<string>;
  readIds: Set<string>;
} {
  return {
    readIds: parseIdSet(
      request.cookies.get(getCookieName('read', userId))?.value
    ),
    hiddenIds: parseIdSet(
      request.cookies.get(getCookieName('hidden', userId))?.value
    ),
  };
}

export function markFallbackNotificationsRead(
  response: NextResponse,
  request: NextRequest,
  userId: string,
  notificationIds: string[]
): void {
  const { readIds } = getFallbackNotificationState(request, userId);
  notificationIds.forEach(notificationId => readIds.add(notificationId));
  writeCookie(response, getCookieName('read', userId), readIds);
}

export function hideFallbackNotifications(
  response: NextResponse,
  request: NextRequest,
  userId: string,
  notificationIds: string[]
): void {
  const { hiddenIds } = getFallbackNotificationState(request, userId);
  notificationIds.forEach(notificationId => hiddenIds.add(notificationId));
  writeCookie(response, getCookieName('hidden', userId), hiddenIds);
}
