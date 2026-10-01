function storyExitCode(report) {
  return report.some((entry) => (
    entry.status === 'erro'
    || entry.status === 'parcial'
    || entry.status === 'sem-credencial'
    || entry.falhas > 0
  )) ? 1 : 0;
}

module.exports = { storyExitCode };
