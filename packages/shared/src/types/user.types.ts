import { z } from 'zod';

export enum PermissionLevel {
  VIEWER = 'viewer',
  CONTRIBUTOR = 'contributor',
  MAINTAINER = 'maintainer',
  ADMIN = 'admin',
}

export const GitHubUserSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullable(),
  email: z.string().email().nullable(),
  avatarUrl: z.string().url(),
});

export type GitHubUser = z.infer<typeof GitHubUserSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  githubId: z.number(),
  login: z.string(),
  name: z.string().nullable(),
  email: z.string().email().nullable(),
  avatarUrl: z.string().url().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof UserSchema>;

export const GitHubRepoPermissionSchema = z.object({
  repoFullName: z.string(), // e.g., "salesforcedocs/documentation"
  permission: z.nativeEnum(PermissionLevel),
});

export type GitHubRepoPermission = z.infer<typeof GitHubRepoPermissionSchema>;

export const UserSessionSchema = z.object({
  user: UserSchema,
  githubAccessToken: z.string(),
  permissions: z.array(GitHubRepoPermissionSchema),
  belongsToOrg: z.boolean(), // salesforcedocs org membership
});

export type UserSession = z.infer<typeof UserSessionSchema>;
