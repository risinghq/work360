import { makeAuthSession } from "@tests/support/unit/factories";
import { describe, expect, it } from "vitest";

import {
  decideNavigation,
  isPublicPage,
} from "~/domain/auth/access/navigation";

describe("decideNavigation", () => {
  it("sends a signed-out viewer to the login page", () => {
    expect(decideNavigation(null, "/home")).toEqual({
      kind: "redirect",
      to: "/login",
    });
  });

  it("lets a signed-out viewer open a public page", () => {
    expect(decideNavigation(null, "/legal/privacy")).toEqual({
      kind: "allow",
    });
    expect(decideNavigation(null, "/login/verify")).toEqual({ kind: "allow" });
  });

  it("holds a session that has not finished onboarding on onboarding", () => {
    const viewer = makeAuthSession({
      role: "executive",
      sessionClass: "pre_auth",
    });

    expect(decideNavigation(viewer, "/home")).toEqual({
      kind: "redirect",
      to: "/onboarding",
    });
    expect(decideNavigation(viewer, "/onboarding")).toEqual({ kind: "allow" });
  });

  it("holds a recovery-setup session on the recovery-code page", () => {
    const viewer = makeAuthSession({ sessionClass: "recovery_setup" });

    expect(decideNavigation(viewer, "/records")).toEqual({
      kind: "redirect",
      to: "/recovery-codes",
    });
    expect(decideNavigation(viewer, "/recovery-codes")).toEqual({
      kind: "allow",
    });
  });

  it("sends an app session off the sign-in steps to its home page", () => {
    const viewer = makeAuthSession({ role: "executive" });

    expect(decideNavigation(viewer, "/onboarding")).toEqual({
      kind: "redirect",
      to: "/home",
    });
    expect(
      decideNavigation(makeAuthSession({ role: "logistics" }), "/"),
    ).toEqual({ kind: "redirect", to: "/fulfillment" });
  });

  it("sends a member away from a page they cannot use", () => {
    expect(
      decideNavigation(
        makeAuthSession({ role: "executive" }),
        "/settings/event-logs",
      ),
    ).toEqual({ kind: "redirect", to: "/home" });
    expect(
      decideNavigation(
        makeAuthSession({ role: "back_office", modules: ["cases"] }),
        "/records/lead-1",
      ),
    ).toEqual({ kind: "redirect", to: "/cases" });
  });

  it("allows a member onto a page they can use", () => {
    expect(
      decideNavigation(makeAuthSession({ role: "admin" }), "/settings/profile"),
    ).toEqual({ kind: "allow" });
  });
});

describe("isPublicPage", () => {
  it("matches the public page trees and nothing that only shares a prefix", () => {
    expect(isPublicPage("/docs")).toBe(true);
    expect(isPublicPage("/updates")).toBe(true);
    expect(isPublicPage("/reset-password")).toBe(true);
    expect(isPublicPage("/legal/terms")).toBe(true);
    expect(isPublicPage("/loginx")).toBe(false);
    expect(isPublicPage("/home")).toBe(false);
  });
});
