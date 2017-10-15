module.exports = {
    "env": {
        "browser": true,
        "commonjs": true,
        "es6": true,
        "node": true
    },
    "extends": "eslint:recommended",
    "rules": {
        "indent": [
            "error",
            4
        ],
        "no-console": "off",
        "semi": [
            "error",
            "always"
        ],
        "no-unused-vars": [
            "error", {
                "argsIgnorePattern": "^_"
            }
        ]
    }
};
