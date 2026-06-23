/// <reference path="../pb_data/types.d.ts" />

// Family calendar (blueprint phase 6): a shared calendar of events that anyone
// in the family can see and RSVP to. Anyone can create an event; the creator
// edits/deletes it. RSVPs are per-user (going / maybe / no).
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    const events = new Collection({
      type: 'base',
      name: 'calendar_events',
      fields: [
        { type: 'text', name: 'title', required: true, max: 200 },
        { type: 'editor', name: 'description' },
        { type: 'date', name: 'starts_at', required: true },
        { type: 'date', name: 'ends_at' },
        { type: 'bool', name: 'all_day' },
        { type: 'text', name: 'location', max: 200 },
        { type: 'relation', name: 'created_by', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX `idx_events_starts` ON `calendar_events` (`starts_at`)'],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != "" && created_by = @request.auth.id',
      updateRule: '@request.auth.id != "" && created_by = @request.auth.id',
      deleteRule: '@request.auth.id != "" && created_by = @request.auth.id',
    });
    app.save(events);

    const rsvps = new Collection({
      type: 'base',
      name: 'event_rsvps',
      fields: [
        { type: 'relation', name: 'event', required: true, maxSelect: 1, collectionId: events.id, cascadeDelete: true },
        { type: 'relation', name: 'user', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
        { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['going', 'maybe', 'no'] },
        { type: 'autodate', name: 'created', onCreate: true, onUpdate: false },
        { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_rsvp_unique` ON `event_rsvps` (`event`, `user`)'],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != "" && user = @request.auth.id',
      updateRule: '@request.auth.id != "" && user = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user = @request.auth.id',
    });
    app.save(rsvps);
  },
  (app) => {
    for (const n of ['event_rsvps', 'calendar_events']) {
      try {
        app.delete(app.findCollectionByNameOrId(n));
      } catch (e) {}
    }
  }
);
