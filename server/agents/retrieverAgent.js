const vectorStoreService = require("../services/vectorStoreService");

class RetrieverAgent {
  async execute(state) {
    state.addThought("Retriever Agent", `Starting similarity search for query: "${state.query}"`);
    state.addToolCall("Retriever Agent", "vectorStoreService.similaritySearch", {
      query: state.query,
      topK: state.topK,
    });

    try {
      const results = await vectorStoreService.similaritySearch(state.query, state.topK);
      state.retrievedNodes = results;
      
      if (results.length > 0) {
        state.addObservation(
          "Retriever Agent",
          `Retrieved ${results.length} nodes from local index. Top match: "${results[0].documentTitle}" (score: ${results[0].score})`
        );
      } else {
        state.addObservation("Retriever Agent", "No records found in vector store. Using local library fallback.");
        // Fallback to searching mock library if vector store is empty
        const mockData = require("../mockData"); // We will create this
        const fallbackNodes = [];
        const queryLower = state.query.toLowerCase();

        for (const [key, value] of Object.entries(mockData.REGULATORY_ALERTS || {})) {
          if (value.title.toLowerCase().includes(queryLower) || value.summary.toLowerCase().includes(queryLower)) {
            fallbackNodes.push({
              documentId: key,
              documentTitle: value.title,
              text: value.summary,
              score: 0.8,
            });
          }
        }
        state.retrievedNodes = fallbackNodes.slice(0, state.topK);
        state.addObservation("Retriever Agent", `Library fallback retrieved ${state.retrievedNodes.length} nodes.`);
      }
    } catch (err) {
      console.error("Retriever agent failed:", err);
      state.addThought("Retriever Agent", `Failed to run retrieval: ${err.message}. Defaulting to library lookup.`);
    }

    return state;
  }
}

module.exports = new RetrieverAgent();
