/**
 * The Theory of Relativity
 * 
 * This file contains a brief overview of Albert Einstein's groundbreaking theories.
 */

const theoryOfRelativity = {
  special: {
    year: 1905,
    coreConcept: "The laws of physics are the same for all non-accelerating observers.",
    famousEquation: "E = mc^2",
    implications: [
      "Time dilation: Time moves slower for objects moving at high speeds.",
      "Length contraction: Objects shorten in the direction of motion at high speeds.",
      "Mass-energy equivalence: Mass and energy are interchangeable."
    ]
  },
  general: {
    year: 1915,
    coreConcept: "Gravity is not a force, but a curvature of spacetime caused by mass and energy.",
    keyPredictions: [
      "Gravitational lensing: Light bends around massive objects.",
      "Gravitational time dilation: Time moves slower in stronger gravitational fields.",
      "Black holes: Regions where spacetime curvature is so extreme nothing can escape."
    ]
  }
};

console.log("Einstein's Legacy:", theoryOfRelativity.special.famousEquation);

module.exports = theoryOfRelativity;
