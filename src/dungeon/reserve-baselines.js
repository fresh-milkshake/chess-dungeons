// Visible bottom edge of each white Neo sprite (alpha >= 100, at least 3% row coverage).
// Normalized by source height; ignores transparent padding and isolated specks.
export const reserveBaselines={
  "ordinary": {
    "p": 0.9066667,
    "n": 0.9066667,
    "b": 0.9066667,
    "r": 0.9066667,
    "q": 0.9066667,
    "k": 0.9066667
  },
  "stone": {
    "p": 0.8899522,
    "n": 0.9090909,
    "b": 0.8875598,
    "r": 0.9059011,
    "q": 0.891547
  },
  "glass": {
    "p": 0.8732057,
    "n": 0.891547,
    "b": 0.8867624,
    "r": 0.9098884,
    "q": 0.8748006
  },
  "ethereal": {
    "p": 0.9059011,
    "n": 0.9114833,
    "b": 0.9059011,
    "r": 0.9082935,
    "q": 0.900319
  },
  "diamond": {
    "p": 0.9027113,
    "n": 0.907496,
    "b": 0.9106858,
    "r": 0.9098884,
    "q": 0.9059011
  }
};
