import { createContext } from "react";

// LOD = level of detail. true = hodně odzoomováno → lístečky kreslíme zjednodušeně
// (bez stínu/rotace/tlačítek), aby plátno se 100+ uzly neškubalo. Práh řídí BoardClient.
export const LodContext = createContext(false);
