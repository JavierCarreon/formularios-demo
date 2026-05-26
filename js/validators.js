window.FormValidators = (function () {
    function normalize(value) {
        return String(value || '').trim();
    }

    function hasValue(value) {
        return normalize(value).length > 0;
    }

    function requiredText(value, min, max, emptyMessage, lengthMessage) {
        var text = normalize(value);

        if (!text) {
            return { valid: false, filled: false, message: emptyMessage };
        }

        if (text.length < min || text.length > max) {
            return { valid: false, filled: true, message: lengthMessage };
        }

        return { valid: true, filled: true, message: '' };
    }

    function optionalText(value, min, max, lengthMessage) {
        var text = normalize(value);

        if (!text) {
            return { valid: true, filled: false, message: '' };
        }

        if (text.length < min || text.length > max) {
            return { valid: false, filled: true, message: lengthMessage };
        }

        return { valid: true, filled: true, message: '' };
    }

    function requiredUppercaseText(value, min, max, emptyMessage, lengthMessage, uppercaseMessage) {
        var textResult = requiredText(value, min, max, emptyMessage, lengthMessage);
        var text = normalize(value);

        if (!textResult.valid) {
            return textResult;
        }

        if (text !== text.toUpperCase()) {
            return { valid: false, filled: true, message: uppercaseMessage };
        }

        return textResult;
    }

    function optionalUppercaseText(value, min, max, lengthMessage, uppercaseMessage) {
        var textResult = optionalText(value, min, max, lengthMessage);
        var text = normalize(value);

        if (!textResult.valid || !text) {
            return textResult;
        }

        if (text !== text.toUpperCase()) {
            return { valid: false, filled: true, message: uppercaseMessage };
        }

        return textResult;
    }

    function practiceId(value, message) {
        var text = normalize(value);

        if (!text) {
            return { valid: false, filled: false, message: message };
        }

        if (!/^\d{1,6}$/.test(text)) {
            return { valid: false, filled: true, message: message };
        }

        return { valid: true, filled: true, message: '' };
    }

    function phone10(value, message) {
        var text = normalize(value);

        if (!text) {
            return { valid: false, filled: false, message: 'Campo requerido. Ingresa un celular válido (10 dígitos).' };
        }

        if (!/^\d{10}$/.test(text)) {
            return { valid: false, filled: true, message: message };
        }

        return { valid: true, filled: true, message: '' };
    }

    function email(value, emptyMessage, invalidMessage) {
        var text = normalize(value);
        var pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!text) {
            return { valid: false, filled: false, message: emptyMessage };
        }

        if (!pattern.test(text)) {
            return { valid: false, filled: true, message: invalidMessage };
        }

        return { valid: true, filled: true, message: '' };
    }

    function exactEmail(value, expected, mismatchMessage) {
        var emailResult = email(
            value,
            'Campo requerido. Ingresa el correo autorizado para la práctica.',
            'Ingresa un correo electrónico válido.'
        );

        if (!emailResult.valid) {
            return emailResult;
        }

        if (normalize(value).toLowerCase() !== expected.toLowerCase()) {
            return { valid: false, filled: true, message: mismatchMessage };
        }

        return { valid: true, filled: true, message: '' };
    }

    function selected(value, message) {
        if (!hasValue(value)) {
            return { valid: false, filled: false, message: message };
        }

        return { valid: true, filled: true, message: '' };
    }

    function strongPassword(value, message) {
        var text = String(value || '');

        if (!text) {
            return { valid: false, filled: false, message: 'Campo requerido. Ingresa una contraseña.' };
        }

        if (!/(?=.{8,})(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])/.test(text)) {
            return { valid: false, filled: true, message: message };
        }

        return { valid: true, filled: true, message: '' };
    }

    function matches(value, expected, emptyMessage, mismatchMessage) {
        var text = String(value || '');

        if (!text) {
            return { valid: false, filled: false, message: emptyMessage };
        }

        if (text !== String(expected || '')) {
            return { valid: false, filled: true, message: mismatchMessage };
        }

        return { valid: true, filled: true, message: '' };
    }

    function checked(input, message) {
        if (!input || !input.checked) {
            return { valid: false, filled: false, message: message };
        }

        return { valid: true, filled: true, message: '' };
    }

    return {
        normalize: normalize,
        requiredText: requiredText,
        optionalText: optionalText,
        requiredUppercaseText: requiredUppercaseText,
        optionalUppercaseText: optionalUppercaseText,
        practiceId: practiceId,
        phone10: phone10,
        exactEmail: exactEmail,
        selected: selected,
        strongPassword: strongPassword,
        matches: matches,
        checked: checked
    };
})();
