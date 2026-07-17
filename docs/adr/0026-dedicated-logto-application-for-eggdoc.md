# Dedicated Logto application for EggDoc

EggDoc uses its own Logto OIDC application instead of sharing client credentials with Infinite Canvas, while relying on the same EggAi identity tenant and New API resource audience. Separate callback URLs, secrets, and deployment configuration isolate the two products without creating a second user identity or changing the ecosystem scopes used to retrieve personalized configuration.
