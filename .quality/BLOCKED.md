# Iteration blocked: the prompt template was never rendered

**Outcome:** no code changes. Stopping under Rule 6.

## What happened

The assignment arrived with every parameter still a literal placeholder
rather than a substituted value:

    iteration        {iteration}
    composite        {composite}/100
    target           {target}
    scoreboard       {scoreboard}
    focus            {focus}
    focus_score      {focus_score}/100
    focus_cmd        {focus_cmd}
    evidence         {evidence}
    history          {history}
    protected        {protected}

Not one field was filled in. This is a rendering failure in the harness that
builds the prompt, upstream of anything in this repository.

## Why I did not proceed anyway

Three of the missing fields are individually disqualifying:

1. **`{focus}` / `{focus_cmd}`** — I do not know which dimension I am meant to
   improve, or the command that scores it. The definition of done is
   "`{focus_cmd}` scores measurably higher"; I cannot run an unknown command,
   so I cannot satisfy or verify the goal. Picking a plausible-looking metric
   and improving that is guessing, which Rule 6 explicitly rules out.

2. **`{protected}`** — I do not know which paths are read-only. Rule 2 says
   touching them fails the iteration outright. Any edit I made would be a blind
   bet against an unknown list.

3. **`{history}`** — I do not know what was already tried and reverted. Rule 1
   warns against repeating a reverted approach, and I have no way to avoid one.

Working under these conditions has a bad expected value in both directions: a
wrong guess either fails on a protected path, repeats a known-reverted
approach, or moves a dimension nobody asked about while risking a regression
elsewhere. Rule 6 says a truthful stop is a valid outcome. This is one.

## What I checked before stopping

To be sure the values were not recoverable from the repo rather than the prompt:

    ls .quality/                       -> did not exist (created for this file)
    find . -name 'quality*.{json,yml,yaml}' -o -name 'scoreboard*'
                                       -> no matches
    grep -rl 'composite|focus_cmd|scoreboard' (excluding node_modules/.git/.next)
                                       -> no matches

The harness is external to this repository, so its configuration cannot be
reconstructed here.

## Repository state

Untouched. Clean working tree on `main` at 30ad4d6. This file is the only
addition, written because Rule 6 directs the reasoning here.

## To unblock

Re-run the iteration with the template actually interpolated. The minimum
needed to do useful work is `focus`, `focus_cmd`, and `protected`; `history`
and `evidence` prevent repeating dead ends.

Worth checking in the harness: the values may be arriving as an empty dict or
an object whose keys do not match the placeholder names, since the failure is
uniform across every field rather than affecting only some.
