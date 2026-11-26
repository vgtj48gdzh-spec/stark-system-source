import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FORMAL_ACTOR_IDENTITY_KEY = 'requireFormalActorIdentity';

/**
 * Marks a state-changing route as unavailable to the legacy demo/default-user
 * identity paths. The request must have been bound to an active user by the
 * trusted loopback reverse-proxy contract in CurrentUserGuard.
 */
export const RequireFormalActorIdentity = () =>
  SetMetadata(REQUIRE_FORMAL_ACTOR_IDENTITY_KEY, true);
