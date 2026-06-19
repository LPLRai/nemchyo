/// <reference path="../pb_data/types.d.ts" />

// Media: let a message carry a file (photo or document). Images get auto
// thumbnails (100x100 for previews, 600x0 for the in-chat view).
migrate((app) => {
  const messages = app.findCollectionByNameOrId("messages");
  messages.fields.add(
    new Field({
      type: "file",
      name: "file",
      maxSelect: 1,
      maxSize: 52428800, // 50 MB
      mimeTypes: [], // allow any (images + documents)
      thumbs: ["100x100", "600x0"],
    })
  );
  messages.fields.add(new Field({ type: "text", name: "file_name", max: 255 }));
  app.save(messages);
}, (app) => {
  const messages = app.findCollectionByNameOrId("messages");
  try { messages.fields.removeByName("file"); } catch (e) {}
  try { messages.fields.removeByName("file_name"); } catch (e) {}
  app.save(messages);
});
