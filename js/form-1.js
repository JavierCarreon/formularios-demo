document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('registration-form');
    var submitButton = document.getElementById('submit-btn');
    var resultPanel = document.getElementById('practice-result');

    var fields = [
        {
            id: 'practitioner-name',
            label: 'Nombre del colaborador en capacitación',
            required: true,
            validate: function (input) {
                return FormValidators.requiredText(
                    input.value,
                    2,
                    50,
                    'Campo requerido. Ingresa el nombre del colaborador en capacitación.',
                    'Ingresa entre 2 y 50 caracteres.'
                );
            }
        },
        {
            id: 'practice-branch',
            label: 'Sucursal',
            required: true,
            validate: function (input) {
                return FormValidators.requiredText(
                    input.value,
                    2,
                    50,
                    'Campo requerido. Ingresa la sucursal de práctica.',
                    'Ingresa una sucursal de 2 a 50 caracteres.'
                );
            }
        },
        {
            id: 'practice-id',
            label: 'ID',
            required: true,
            validate: function (input) {
                return FormValidators.practiceId(
                    input.value,
                    'Ingresa un ID numérico de máximo 6 dígitos.'
                );
            }
        },
        {
            id: 'first-name',
            label: 'Primer nombre',
            required: true,
            validate: function (input) {
                return FormValidators.requiredUppercaseText(
                    input.value,
                    2,
                    50,
                    'Campo requerido. Ingresa tu primer nombre.',
                    'Ingresa entre 2 y 50 caracteres.',
                    'Captura este campo en MAYÚSCULAS para que sea correcto.'
                );
            }
        },
        {
            id: 'second-name',
            label: 'Segundo nombre',
            required: false,
            validate: function (input) {
                return FormValidators.optionalUppercaseText(
                    input.value,
                    2,
                    50,
                    'Si completas este campo, ingresa entre 2 y 50 caracteres.',
                    'Captura este campo en MAYÚSCULAS para que sea correcto.'
                );
            }
        },
        {
            id: 'last-name-paternal',
            label: 'Apellido paterno',
            required: true,
            validate: function (input) {
                return FormValidators.requiredUppercaseText(
                    input.value,
                    2,
                    50,
                    'Campo requerido. Ingresa tu apellido paterno.',
                    'Ingresa entre 2 y 50 caracteres.',
                    'Captura este campo en MAYÚSCULAS para que sea correcto.'
                );
            }
        },
        {
            id: 'last-name-maternal',
            label: 'Apellido materno',
            required: true,
            validate: function (input) {
                return FormValidators.requiredUppercaseText(
                    input.value,
                    2,
                    50,
                    'Campo requerido. Ingresa tu apellido materno.',
                    'Ingresa entre 2 y 50 caracteres.',
                    'Captura este campo en MAYÚSCULAS para que sea correcto.'
                );
            }
        },
        {
            id: 'phone',
            label: 'Celular',
            required: true,
            validate: function (input) {
                return FormValidators.phone10(
                    input.value,
                    'Ingresa un celular válido de 10 dígitos numéricos.'
                );
            }
        },
        {
            id: 'email',
            label: 'Correo electrónico',
            required: true,
            validate: function (input) {
                return FormValidators.exactEmail(
                    input.value,
                    'alta@conmigovales.com',
                    'Ingresa el correo autorizado para la práctica: alta@conmigovales.com'
                );
            }
        },
        {
            id: 'reference',
            label: '¿Cómo se enteró de Conmigo vales?',
            required: true,
            validate: function (input) {
                return FormValidators.selected(
                    input.value,
                    'Campo requerido. Selecciona una opción válida.'
                );
            }
        },
        {
            id: 'password',
            label: 'Contraseña',
            required: true,
            validate: function (input) {
                return FormValidators.strongPassword(
                    input.value,
                    'Debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.'
                );
            }
        },
        {
            id: 'confirm-password',
            label: 'Confirmar contraseña',
            required: true,
            validate: function (input) {
                var password = document.getElementById('password');
                return FormValidators.matches(
                    input.value,
                    password ? password.value : '',
                    'Campo requerido. Confirma tu contraseña.',
                    'Las contraseñas no coinciden. Verifica que sean iguales.'
                );
            }
        },
        {
            id: 'privacy-accept',
            label: 'Aviso de privacidad',
            required: true,
            validate: function (input) {
                return FormValidators.checked(
                    input,
                    'Debes aceptar el aviso de privacidad para continuar.'
                );
            }
        }
    ];

    setupPracticeIdInput();
    setupPasswordToggles();

    if (submitButton) {
        submitButton.addEventListener('click', function (event) {
            event.preventDefault();
            runPracticeValidation();
        });
    }

    if (form) {
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            runPracticeValidation();
        });
    }

    function runPracticeValidation() {
        var results = fields.map(function (field) {
            var input = document.getElementById(field.id);
            var result = input ? field.validate(input) : {
                valid: false,
                filled: false,
                message: 'No se encontró el campo en el formulario.'
            };

            updateFieldState(input, result);

            return {
                id: field.id,
                label: field.label,
                required: field.required,
                valid: result.valid,
                filled: result.filled,
                message: result.message
            };
        });

        var metrics = PracticeFeedback.calculate(results);
        var collaborator = document.getElementById('practitioner-name');
        PracticeFeedback.render(resultPanel, collaborator ? collaborator.value.trim() : '', metrics);

        if (resultPanel) {
            resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function updateFieldState(input, result) {
        if (!input) {
            return;
        }

        var container = getFieldContainer(input);
        var message = getErrorMessageElement(input, container);

        input.classList.toggle('field-invalid', !result.valid);
        input.classList.toggle('field-valid', result.valid);
        input.setAttribute('aria-invalid', String(!result.valid));

        if (message) {
            message.textContent = result.valid ? '' : result.message;
            message.hidden = result.valid;
        }
    }

    function getFieldContainer(input) {
        return input.closest('.form-group') || input.closest('.checkbox-group') || input.parentElement;
    }

    function getErrorMessageElement(input, container) {
        var id = input.id + '-error';
        var message = document.getElementById(id);

        if (!message) {
            message = document.createElement('small');
            message.id = id;
            message.className = 'field-error';
            message.hidden = true;

            if (input.type === 'checkbox') {
                container.appendChild(message);
            } else {
                var helper = container.querySelector('.helper-text');
                if (helper) {
                    container.insertBefore(message, helper);
                } else {
                    container.appendChild(message);
                }
            }

            input.setAttribute('aria-describedby', id);
        }

        return message;
    }

    function setupPasswordToggles() {
        var toggles = document.querySelectorAll('[data-password-toggle]');

        toggles.forEach(function (toggle) {
            toggle.addEventListener('click', function () {
                var input = document.getElementById(toggle.getAttribute('data-password-toggle'));
                if (!input) {
                    return;
                }

                var isHidden = input.type === 'password';
                input.type = isHidden ? 'text' : 'password';
                toggle.textContent = isHidden ? 'Ocultar' : 'Mostrar';
            });
        });
    }

    function setupPracticeIdInput() {
        var practiceId = document.getElementById('practice-id');

        if (!practiceId) {
            return;
        }

        practiceId.addEventListener('input', function () {
            practiceId.value = practiceId.value.replace(/\D/g, '').slice(0, 6);
        });
    }
});
