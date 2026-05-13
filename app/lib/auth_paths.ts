import type { User } from "./api_user";

export function getRedirectPathByRole(user: Pick<User, "role">): string {
  if (user.role === "admin") {
    return "/admin";
  }

  if (user.role === "instructor") {
    return "/instructor";
  }

  return "/student";
}
