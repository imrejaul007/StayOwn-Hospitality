import { ApplicationError } from '../middleware/errorHandler.js';

/** Minimal profanity list — extend via hotel policy later */
const PROFANITY_WORDS = [
  'fuck', 'shit', 'bitch', 'bastard', 'cunt', 'slut', 'whore', 'nazi', 'rape'
];

const URL_RE = /\bhttps?:\/\/[^\s]+/gi;
const URL_RE_LOOSE = /\bwww\.[^\s]+/gi;

/**
 * @param {string} text
 * @param {{ blockUrls?: boolean, profanityAction?: 'none' | 'block' | 'sanitize' }} policy
 * @returns {string}
 */
export function moderateMeetUpText(text, policy = {}) {
  if (text == null || text === '') return text;
  const blockUrls = policy.blockUrls !== false;
  const profanityAction = policy.profanityAction || 'sanitize';

  let t = String(text);
  if (blockUrls) {
    t = t.replace(URL_RE, '[link removed]');
    t = t.replace(URL_RE_LOOSE, '[link removed]');
  }

  if (profanityAction === 'block') {
    const lower = t.toLowerCase();
    for (const w of PROFANITY_WORDS) {
      if (lower.includes(w)) {
        throw new ApplicationError('This text contains words that are not allowed. Please revise your message.', 400, 'MEETUP_CONTENT_BLOCKED');
      }
    }
    return t;
  }

  if (profanityAction === 'sanitize') {
    let out = t;
    for (const w of PROFANITY_WORDS) {
      const re = new RegExp(`\\b${escapeRe(w)}\\b`, 'gi');
      out = out.replace(re, '•••');
    }
    return out;
  }

  return t;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {object} body — create request body fields
 * @param {Record<string, unknown>} guestExperience — HotelSettings.guestExperience subset
 */
export function moderateMeetUpCreateBody(body, guestExperience = {}) {
  if (!body || typeof body !== 'object') return body;
  const ge = guestExperience && typeof guestExperience === 'object' ? guestExperience : {};
  const policy = {
    blockUrls: ge.blockUrlsInMeetUpText !== false,
    profanityAction: ge.profanityAction || 'sanitize'
  };
  const next = { ...body };
  if (typeof next.title === 'string') next.title = moderateMeetUpText(next.title, policy);
  if (typeof next.description === 'string') next.description = moderateMeetUpText(next.description, policy);
  if (next.location && typeof next.location === 'object') {
    next.location = { ...next.location };
    if (typeof next.location.name === 'string') {
      next.location.name = moderateMeetUpText(next.location.name, policy);
    }
    if (typeof next.location.details === 'string') {
      next.location.details = moderateMeetUpText(next.location.details, policy);
    }
  }
  return next;
}
