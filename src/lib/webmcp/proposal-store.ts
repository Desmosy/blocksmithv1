/**
 * The component an agent has put in front of the human.
 *
 * The tools that receive a proposal and the panel that displays it live in
 * different parts of the wiki tree, and threading state between them through
 * the shell would couple every layer in between to a feature none of them care
 * about. A tiny store keeps that seam small.
 *
 * This is what makes the loop agentic rather than clerical: nobody pastes
 * anything. The agent proposes, the page shows it, the human looks.
 */

export type Proposal = {
  code: string;
  /** What the agent said it was building. */
  intent?: string;
  at: number;
};

type Listener = (proposal: Proposal | null) => void;

let current: Proposal | null = null;
const listeners = new Set<Listener>();

export function getProposal(): Proposal | null {
  return current;
}

export function setProposal(next: Proposal | null): void {
  current = next;
  for (const listen of listeners) listen(current);
}

export function subscribeToProposals(listen: Listener): () => void {
  listeners.add(listen);
  return () => {
    listeners.delete(listen);
  };
}
