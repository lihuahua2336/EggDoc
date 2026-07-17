# Return API credentials without persisting them

EggDoc may retrieve a Reader's raw EggAi API credential through an authenticated server route and return it only to that Reader's browser so integration configuration can be displayed and copied. The response must not be cached, logged, monitored as payload data, or persisted by EggDoc or browser storage; an authenticated tutorial panel may display the selected key in plaintext, while anonymous content uses placeholders.
