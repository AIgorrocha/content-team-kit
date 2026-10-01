function parseStoryAccountScope(args = []) {
  const index = args.indexOf('--account');
  if (index === -1) return 'principal';

  const value = args[index + 1];
  if (!['principal', 'business', 'all'].includes(value)) {
    throw new Error('--account exige principal, business ou all');
  }
  return value;
}

module.exports = { parseStoryAccountScope };
