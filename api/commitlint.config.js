// commitlint.config.js
// Conventional Commits enforcement — https://commitlint.js.org/
// NOTE: this file lives in api/ (next to package.json) so that
// '@commitlint/config-conventional' resolves from api/node_modules.
export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        // Custom rule: the subject must start with a lowercase letter and
        // contain only English characters (a-z, 0-9, whitespace, punctuation).
        'subject-english-only': (parsed, _when, _value) => {
          const subject = parsed.subject ?? '';
          const isValid = /^[a-z][a-z0-9\s\-_.,:;!?'"()/&+@#%*`\[\]]*$/.test(subject);
          return [
            isValid,
            `subject must start with a lowercase letter and contain only English characters: "${subject}"`,
          ];
        },
      },
    },
  ],
  rules: {
    // Force the subject to be entirely lowercase
    'subject-case': [2, 'always', 'lower-case'],
    // Keep the full header (type: subject) within 72 characters
    'header-max-length': [2, 'always', 72],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
    'subject-english-only': [2, 'always'],
  },
};
