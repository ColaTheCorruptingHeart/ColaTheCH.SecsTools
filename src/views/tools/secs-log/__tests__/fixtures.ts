export const STANDARD_S6F11 = `01:14:32.796 SEND S6F11 W
<L,3
  <U2,1 [DATAID] '4'>
  <U2,1 [CEID] '5'>
  <L,1 [REPORTS]
    <L,2
      <U2 100>
      <L,2
        <A "READY">
        <U2 1 2 3>
      >
    >
  >
>.`

export const BRACKET_S6F11 = `[2026-08-06 01:14:32.7] RECEIVED S6F11 W
<L,3
  <U2 4>
  <U2 5>
  <L,0
  >
>.`

export const COMPACT_S1F12 = `S1F12 W
<L><L,3><U2 1001><A "Temperature > limit"><A 'C'>>>.`

export const STANDARD_S1F12 = `S1F12
<L,2
  <L,3
    <U2 '1001'>
    <A "Temperature">
    <A 'C'>
  >
  <L,2
    <U4 1002>
    <A 'Pressure'>
  >
>.`

export const STANDALONE_S2F41 = `S2F41 W
<L,2
  <A 'START'>
  <L,1
    <L,2
      <A 'LOTID'>
      <A 'LOT-001'>
    >
  >
>.`

export const S6F11_CHANGED = STANDARD_S6F11.replace('<A "READY">', '<A "RUNNING">')

export const MULTI_DIALECT_LOG = `${STANDARD_S6F11}

${BRACKET_S6F11}

[2026/08/06 01:14:33.123456] H->E S2F41 W
<L,2
  <A 'START'>
  <L,0
  >
>.`
