const Document = require("../models/document");
const vectorStoreService = require("./vectorStoreService");

class DbSyncService {
  /**
   * Syncs all unsynced documents in MongoDB into the Vector Store
   */
  async syncUnsynced() {
    try {
      const unsyncedDocs = await Document.find({ vectorSync: { $ne: true } });
      if (unsyncedDocs.length === 0) {
        console.log("Vector DB is fully in sync with MongoDB.");
        return { synced: 0 };
      }

      console.log(`Found ${unsyncedDocs.length} unsynced documents. Syncing...`);
      let count = 0;

      for (const doc of unsyncedDocs) {
        await vectorStoreService.addDocument(doc._id, doc.title, doc.extractedText);
        doc.vectorSync = true;
        await doc.save();
        count++;
      }

      console.log(`Successfully synced ${count} documents.`);
      return { synced: count };
    } catch (err) {
      console.error("Failed syncing documents with Vector Store:", err);
      throw err;
    }
  }

  /**
   * Clears the Vector Store and re-indexes all documents in MongoDB
   */
  async reindexAll() {
    try {
      console.log("Flushing local vector database...");
      vectorStoreService.flush();

      // Reset sync status in MongoDB
      await Document.updateMany({}, { vectorSync: false });

      // Load all documents
      const allDocs = await Document.find({});
      console.log(`Re-indexing ${allDocs.length} documents...`);
      let count = 0;

      for (const doc of allDocs) {
        await vectorStoreService.addDocument(doc._id, doc.title, doc.extractedText);
        doc.vectorSync = true;
        await doc.save();
        count++;
      }

      return { reindexed: count };
    } catch (err) {
      console.error("Re-indexing error:", err);
      throw err;
    }
  }
}

module.exports = new DbSyncService();
