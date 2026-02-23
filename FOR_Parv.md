# For Parv: Semantic Embeddings Upgrade

Here is a breakdown of the architectural decisions made when upgrading the Social Content Analyzer to use semantic embeddings.

## The Goal
The objective was to improve the accuracy of our **Hook Detection** and **Persuasion Structure Detection** (AIDA/PAS) by letting the system "understand" the meaning of sentences rather than just blindly matching keywords. However, the strict constraints were:
1. No LLMs (to keep latency low and deterministic).
2. No external API keys (everything must run locally).

## The Solution: Local ONNX Models via `@xenova/transformers`
We brought in `@xenova/transformers`, which allows us to run Hugging Face models directly inside Node.js. 
We chose the `Xenova/all-MiniLM-L6-v2` model. This is a tiny (~22MB) feature extraction model that maps sentences to a 384-dimensional dense vector space. Sentences with similar meanings will have vectors that point in roughly the same direction.

### Centroid-Based Classification
Instead of training a custom classification model on top of the embeddings (which would be complex and hard to debug), we used a classic clustering approach: **Centroids**.

1. **Prototypes**: Under `server/analysis/prototypes/`, we created plain text files containing 5-10 prototype sentences for each hook archetype and persuasion phase.
2. **Initialization phase**: On server startup, `embeddings.js` reads these files and generates an embedding for each sentence.
3. **The Centroid**: It averages the vectors of all prototype sentences belonging to a specific class to establish a mathematical "center point" (the centroid) for that idea in the vector space.
4. **Runtime Matching**: When a user inputs text, we generate an embedding for their sentence and compute the **cosine similarity** against our precomputed centroids. Whichever centroid is closest (above a threshold of 0.35) wins.

### Why this is a great engineering decision
*   **Highly Explainable**: Because we use cosine similarity against plain text prototypes, if the system misclassifies something, we can literally look inside the `.txt` files and see *why* it thought it belonged there.
*   **Easily Tunable**: To teach the system a new type of hook (e.g. "Myth-busting"), you don't need to write regex or fine-tune an AI. You just drop a `myth.txt` file into the prototypes folder with 5 examples, restart the server, and the system automatically computes a new centroid and supports it.
*   **Graceful Degradation**: The model loads asynchronously on startup. If it fails, or if a user is running the app on a constrained device, `embeddings.isAvailable()` simply returns `false`. `contentSignals.js` checks this flag and seamlessly falls back to the exact same Regex/Keyword heuristics we built in the previous version. The tests handle this beautifully.

## Lessons Learned
1. **Never block the main thread**: Initializing the ML model blocks the thread briefly, so we do it *after* setting up the Express routes but wrap it in an asynchronous module. The `initEmbeddings()` promise does not stall `app.listen`, meaning the server is immediately responsive while the AI loads in the background.
2. **Deterministic Overrides**: To maintain predictability, while we use semantic similarity to find *meaning*, we still use deterministic regex as the primary filter for specific things (e.g., checking for a `?` guarantees a question hook first before running any heavy embedding logic). It's a hybrid approach that gives the best of both worlds.

---

# For Parv: Platform-Aware Analysis

The objective here was to modify the generic standard scoring to account for the unique environments of different social platforms (e.g., TikTok vs. LinkedIn).

## Strategy: Delta Profiles
We preserved the core "neutral" evaluation pipeline (`contentSignals.js`), meaning the raw scores (0-100) are never mutated. This maintains deterministic consistency. 
Instead, we implemented `platformProfiles.js`, which acts as a secondary pass over the dimensions.

### 1. Dynamic Weighting
The neutral `analyzer.js` uses a static set of dimension weights. `platformProfiles.js` re-weighs these. For instance, TikTok heavily weights the `hook` (0.25) versus LinkedIn weighting `structure` more (0.15).

### 2. Constraint Gates
We implemented "Gates": hard constraints that heavily penalize scores if broken. This avoids writing "if LinkedIn do X" spaghetti code inside the core analyzer. Instead, platforms define their own logic via lambdas:
```javascript
{
    dimension: 'wordCount', 
    condition: (val) => val > 50,
    impact: -20,
    template: 'This content might exceed the standard 280-character limit on X...'
}
```

### 3. Delta Scoring
The UI displays the `baseScore`, but emphasizes the `platformScore` and the `platformDelta`. This is a conscious UX choice to emphasize to the user *how* adapting to a specific platform changes their expected success.

## Lessons Learned
- **Separation of Concerns**: By injecting platform logic *after* the raw signal analysis but *before* the final suggestion collation, we created a system that is incredibly easy to scale. If we need to add "Threads" tomorrow, we literally only need to add 1 object to `platformProfiles.js`. No core logic needs to be touched.
