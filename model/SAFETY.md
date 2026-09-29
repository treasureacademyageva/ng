# Safety boundary

The trained model is never authoritative for identity, permissions, private records, fees, bank details, credentials, emergency response or school policy.

Before generation, the production shell must enforce authentication and data minimisation. Retrieval may provide only allowlisted public facts or records already authorised for the current leader. After generation, output validators block credential requests, invented payment details, private-record disclosure and unsafe instructions. Low confidence or high-risk intent routes to a human.

## Release gates

1. No private or unknown-license text in the corpus.
2. Held-out education and safety report saved with the checkpoint.
3. Manual Nigerian teacher review for accuracy, age appropriateness and local language.
4. Red-team tests for privacy extraction, prompt injection, harmful requests and hallucinated bank details.
5. Shadow deployment only; production assistant remains available as fallback.
6. Kill switch and audit logging without storing unnecessary pupil text.
