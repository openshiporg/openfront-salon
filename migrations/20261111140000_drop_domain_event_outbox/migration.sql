-- The DomainEvent outbox and its dispatcher are removed (fleet rule: no outbox/worker machinery).
DROP TABLE IF EXISTS "DomainEvent";
DROP TYPE IF EXISTS "DomainEventOperationType";
DROP TYPE IF EXISTS "DomainEventStatusType";
