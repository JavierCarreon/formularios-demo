document.addEventListener('DOMContentLoaded', function () {
    var state = {
        currentStep: 1,
        values: {},
        documents: {},
        records: {
            references: [],
            distributorExperience: [],
            catalogExperience: [],
            beneficiaries: [],
            coinsured: []
        },
        optionalSteps: {
            2: false,
            3: false,
            4: false
        },
        editingRecord: null,
        deletingRecord: null
    };

    var postalCatalog = {};

    setupMemoryState(state);
    setupInputLimits();
    setupForm3Catalogs(postalCatalog);
    setupPostalCodeLookups(postalCatalog, state);
    setupConditionalFields(state);
    setupSpouseSection(state);
    setupDistributorExperience(state);
    setupTransactionalProfile(state);
    setupOptionalSteps(state);
    setupRecordTables(state);
    setupDocuments(state);
    setupNavigation(state);
    setupPreviewModal();
    setupPrintState();
    renderStep(state);
});

function setupMemoryState(state) {
    document.querySelectorAll('.form3-page input:not([type="file"]), .form3-page select').forEach(function (control) {
        state.values[control.id] = control.value;
        control.addEventListener('input', function () {
            state.values[control.id] = control.value;
        });
        control.addEventListener('change', function () {
            state.values[control.id] = control.value;
        });
    });
}

function setupInputLimits() {
    var practiceId = document.getElementById('form3-practice-id');

    if (practiceId) {
        practiceId.maxLength = 6;
        practiceId.inputMode = 'numeric';
        practiceId.addEventListener('input', function () {
            practiceId.value = practiceId.value.replace(/\D/g, '').slice(0, 6);
        });
    }

    document.querySelectorAll('.form3-page input').forEach(function (input) {
        var id = input.id || '';

        if (isPhoneField(input)) {
            input.maxLength = 10;
            input.inputMode = 'numeric';
            input.addEventListener('input', function () {
                input.value = input.value.replace(/\D/g, '').slice(0, 10);
            });
        }

        if (isPostalField(input)) {
            input.maxLength = 5;
            input.inputMode = 'numeric';
            input.addEventListener('input', function () {
                input.value = input.value.replace(/\D/g, '').slice(0, 5);
            });
        }

        if (isRfcField(input) || id.indexOf('curp') >= 0) {
            input.maxLength = id.indexOf('curp') >= 0 ? 18 : 13;
            input.addEventListener('input', function () {
                input.value = input.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, input.maxLength);
            });
        }

        if (isNumericField(input)) {
            input.inputMode = 'numeric';
            input.addEventListener('input', function () {
                input.value = input.value.replace(/\D/g, '');
            });
        }
    });
}

function setupForm3Catalogs(postalCatalog) {
    Promise.all([
        getLocalJson('../data/formulario-2-selects.json'),
        getLocalJson('../data/actividades-sat.json'),
        getLocalJson('../data/sepomex-index.json')
    ]).then(function (catalogs) {
        var selects = catalogs[0] || {};
        var activities = catalogs[1] || [];
        var sepomex = catalogs[2] || {};

        populateSelects([
            'spouse-birth-state',
            'guarantor-birth-state'
        ], selects.entidades);
        populateSelects([
            'spouse-birth-country',
            'guarantor-birth-country'
        ], selects.paises);
        populateSelects([
            'spouse-nationality',
            'guarantor-nationality'
        ], selects.nacionalidades || ['Mexicana']);
        populateSelects(['guarantor-activity'], activities);

        Object.keys(sepomex).forEach(function (cp) {
            postalCatalog[cp] = sepomex[cp];
        });
    }).catch(function () {
        postalCatalog['34000'] = {
            colonias: ['Zona Centro', 'Analco'],
            municipio: 'Durango',
            ciudad: 'Durango',
            estado: 'Durango',
            pais: 'México'
        };
        postalCatalog['82140'] = {
            colonias: ['Estadio', 'Telleria', 'Ferrocarrilera'],
            municipio: 'Mazatlán',
            ciudad: 'Mazatlán',
            estado: 'Sinaloa',
            pais: 'México'
        };
    });
}

function getLocalJson(path) {
    return fetch(path).then(function (response) {
        if (!response.ok) {
            throw new Error('No se pudo cargar el catálogo local.');
        }
        return response.json();
    });
}

function populateSelects(ids, items) {
    if (!Array.isArray(items)) {
        return;
    }

    ids.forEach(function (id) {
        var select = document.getElementById(id);
        var previousValue = select && select.value;

        if (!select) {
            return;
        }

        select.innerHTML = '<option value="">Seleccione una opción</option>';
        items.forEach(function (item) {
            var option = document.createElement('option');
            option.value = item;
            option.textContent = item;
            select.appendChild(option);
        });
        if (items.indexOf(previousValue) >= 0) {
            select.value = previousValue;
        }
    });
}

function setupPostalCodeLookups(postalCatalog, state) {
    [
        {
            postal: 'economic-postal',
            neighborhood: 'economic-neighborhood',
            municipality: 'economic-municipality',
            city: 'economic-city',
            state: 'economic-state',
            country: 'economic-country'
        },
        {
            postal: 'guarantor-postal',
            neighborhood: 'guarantor-neighborhood',
            municipality: 'guarantor-municipality',
            city: 'guarantor-city',
            state: 'guarantor-state',
            country: 'guarantor-country'
        },
        {
            postal: 'guarantor-business-postal',
            neighborhood: 'guarantor-business-neighborhood',
            municipality: 'guarantor-business-municipality',
            city: 'guarantor-business-city',
            state: 'guarantor-business-state',
            country: 'guarantor-business-country'
        }
    ].forEach(function (config) {
        var postal = document.getElementById(config.postal);
        if (!postal) {
            return;
        }

        ensureManualNeighborhood(config, state);
        postal.addEventListener('input', function () {
            if (postal.value.length === 5) {
                applyPostalCatalog(config, postal.value, postalCatalog, state);
            } else {
                resetPostalFields(config, state);
            }
        });
    });
}

function ensureManualNeighborhood(config, state) {
    var select = document.getElementById(config.neighborhood);
    var manualId = config.neighborhood + '-manual';
    var manual = document.getElementById(manualId);

    if (!select || manual) {
        return;
    }

    manual = document.createElement('input');
    manual.type = 'text';
    manual.id = manualId;
    manual.placeholder = 'Colonia';
    manual.hidden = true;
    manual.dataset.manualNeighborhood = config.neighborhood;
    select.insertAdjacentElement('afterend', manual);
    state.values[manual.id] = manual.value;
    manual.addEventListener('input', function () {
        state.values[manual.id] = manual.value;
    });
}

function applyPostalCatalog(config, cp, postalCatalog, state) {
    var data = postalCatalog[cp];
    var select = document.getElementById(config.neighborhood);
    var manual = document.getElementById(config.neighborhood + '-manual');

    if (!select) {
        return;
    }

    if (!data) {
        select.hidden = true;
        select.value = '';
        if (manual) {
            manual.hidden = false;
            manual.value = '';
            state.values[manual.id] = '';
        }
        [config.municipality, config.city, config.state, config.country].forEach(function (id) {
            var input = document.getElementById(id);
            if (input) {
                input.value = '';
                input.readOnly = false;
                state.values[id] = '';
            }
        });
        return;
    }

    select.hidden = false;
    select.innerHTML = '<option value="">Seleccione una opción</option>';
    data.colonias.forEach(function (colonia) {
        var option = document.createElement('option');
        option.value = colonia;
        option.textContent = colonia;
        select.appendChild(option);
    });
    if (manual) {
        manual.hidden = true;
        manual.value = '';
        state.values[manual.id] = '';
    }

    setAddressValue(config.municipality, data.municipio, state);
    setAddressValue(config.city, data.ciudad || data.municipio, state);
    setAddressValue(config.state, data.estado, state);
    setAddressValue(config.country, data.pais, state);
}

function resetPostalFields(config, state) {
    var select = document.getElementById(config.neighborhood);
    var manual = document.getElementById(config.neighborhood + '-manual');

    if (select) {
        select.hidden = false;
        select.innerHTML = '<option value="">Seleccione una opción</option>';
    }
    if (manual) {
        manual.hidden = true;
        manual.value = '';
        state.values[manual.id] = '';
    }
    [config.municipality, config.city, config.state, config.country].forEach(function (id) {
        setAddressValue(id, '', state, false);
    });
}

function setAddressValue(id, value, state, readOnly) {
    var input = document.getElementById(id);
    if (!input) {
        return;
    }
    input.value = value || '';
    input.readOnly = readOnly !== false && !!value;
    state.values[id] = input.value;
}

function setupConditionalFields(state) {
    document.querySelectorAll('[data-toggle-fields]').forEach(function (control) {
        control.addEventListener('change', function () {
            setConditionalVisibility(control.dataset.toggleFields, control.value === 'si', state);
        });
    });
}

function setupSpouseSection(state) {
    var civilStatus = document.getElementById('civil-status');

    if (!civilStatus) {
        return;
    }

    civilStatus.addEventListener('change', function () {
        var spouse = document.querySelector('[data-form3-spouse]');
        var visible = civilStatus.value === 'Casado(a)';

        if (!spouse) {
            return;
        }

        spouse.hidden = !visible;
        if (!visible) {
            spouse.querySelectorAll('input, select').forEach(function (control) {
                control.value = '';
                state.values[control.id] = '';
            });
        }
    });
}

function setupDistributorExperience(state) {
    var select = document.getElementById('distributor-experience');

    if (!select) {
        return;
    }

    select.addEventListener('change', function () {
        applyDistributorExperienceVisibility(state);
    });
    applyDistributorExperienceVisibility(state);
}

function applyDistributorExperienceVisibility(state) {
    var select = document.getElementById('distributor-experience');
    var value = select ? select.value : '';

    document.querySelectorAll('[data-experience-section]').forEach(function (section) {
        var type = section.dataset.experienceSection;
        var visible = (value === 'Si' && type === 'distributor') ||
            (value === 'Experiencia de venta por catálogo' && type === 'catalog');
        section.hidden = !visible;
    });
}

function setupTransactionalProfile(state) {
    var advancePayments = document.getElementById('advance-payments');
    var earlyPayoff = document.getElementById('early-payoff');
    var neutralFields = [
        { id: 'advance-count', value: '0' },
        { id: 'advance-min', value: '$ 0.00' },
        { id: 'advance-max', value: '$ 0.00' },
        { id: 'advance-frequency', value: '0' },
        { id: 'payment-instrument', value: '0' }
    ];

    function applyNeutralValues() {
        var shouldReset = (!advancePayments || advancePayments.value === 'No') &&
            (!earlyPayoff || earlyPayoff.value === 'No');

        if (!shouldReset) {
            return;
        }

        neutralFields.forEach(function (field) {
            var control = document.getElementById(field.id);
            if (control) {
                control.value = field.value;
                state.values[control.id] = control.value;
            }
        });
    }

    [advancePayments, earlyPayoff].forEach(function (control) {
        if (control) {
            control.addEventListener('change', applyNeutralValues);
        }
    });
    applyNeutralValues();
}

function setupOptionalSteps(state) {
    document.querySelectorAll('[data-form3-step-toggle]').forEach(function (toggle) {
        var step = Number(toggle.dataset.form3StepToggle);
        state.optionalSteps[step] = toggle.checked;

        toggle.addEventListener('change', function () {
            state.optionalSteps[step] = toggle.checked;
            if (step === 2) {
                state.optionalSteps[3] = toggle.checked;
                applyOptionalStepState(3, state);
            }
            applyOptionalStepState(step, state);
        });

        applyOptionalStepState(step, state);
    });

    var step2Toggle = document.querySelector('[data-form3-step-toggle="2"]');
    if (step2Toggle) {
        state.optionalSteps[3] = step2Toggle.checked;
        applyOptionalStepState(3, state);
    }
}

function applyOptionalStepState(step, state) {
    var panel = document.querySelector('[data-form3-step-panel="' + step + '"]');
    var enabled = !!state.optionalSteps[step];

    if (!panel) {
        return;
    }

    panel.classList.toggle('form3-step-disabled', !enabled);
    panel.querySelectorAll('input, select, textarea, button').forEach(function (control) {
        if (control.hasAttribute('data-form3-step-toggle')) {
            return;
        }
        control.disabled = !enabled;
    });
}

function setConditionalVisibility(group, visible, state) {
    document.querySelectorAll('[data-conditional="' + group + '"]').forEach(function (field) {
        field.hidden = !visible;

        if (!visible) {
            field.querySelectorAll('input, select').forEach(function (control) {
                control.value = '';
                state.values[control.id] = '';
            });
        }
    });
}

function setupNavigation(state) {
    var nextButton = document.querySelector('[data-form3-next]');
    var backButton = document.querySelector('[data-form3-back]');

    if (nextButton) {
        nextButton.addEventListener('click', function () {
            if (state.currentStep < 4) {
                state.currentStep += 1;
                renderStep(state);
                scrollToFormStart();
                return;
            }

            renderFeedback(state);
        });
    }

    if (backButton) {
        backButton.addEventListener('click', function () {
            if (state.currentStep > 1) {
                state.currentStep -= 1;
                renderStep(state);
                scrollToFormStart();
            }
        });
    }
}

function renderStep(state) {
    var progressCopy = document.querySelector('[data-form3-progress-copy]');
    var backButton = document.querySelector('[data-form3-back]');
    var nextButton = document.querySelector('[data-form3-next]');
    var remaining = 5 - state.currentStep;

    document.querySelectorAll('[data-form3-step-panel]').forEach(function (panel) {
        var active = Number(panel.dataset.form3StepPanel) === state.currentStep;
        panel.hidden = !active;
        panel.classList.toggle('is-active', active);
    });

    document.querySelectorAll('[data-form3-step]').forEach(function (step) {
        var number = Number(step.dataset.form3Step);
        step.classList.toggle('is-active', number === state.currentStep);
        step.classList.toggle('is-complete', number < state.currentStep);
    });

    if (progressCopy) {
        progressCopy.textContent = '¡Estás a solo ' + remaining + ' paso' + (remaining === 1 ? '' : 's') + ' de completar tu solicitud!';
    }
    if (backButton) {
        backButton.hidden = false;
        backButton.disabled = state.currentStep === 1;
        backButton.setAttribute('aria-hidden', state.currentStep === 1 ? 'true' : 'false');
        backButton.classList.toggle('is-placeholder', state.currentStep === 1);
    }
    if (nextButton) {
        nextButton.textContent = state.currentStep === 4 ? 'Finalizar' : 'Continuar';
    }
}

function scrollToFormStart() {
    var form = document.querySelector('.form3-form');
    if (form) {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

var recordDefinitions = {
    references: {
        title: 'Referencias personales o familiares',
        fields: [
            { key: 'firstName', label: 'Primer nombre', required: true },
            { key: 'secondName', label: 'Segundo nombre' },
            { key: 'lastName', label: 'Apellido paterno', required: true },
            { key: 'motherName', label: 'Apellido materno', required: true },
            { key: 'phone', label: 'Celular', type: 'tel', required: true },
            { key: 'relationship', label: 'Parentesco', required: true }
        ],
        columns: ['firstName', 'secondName', 'lastName', 'motherName']
    },
    distributorExperience: {
        title: 'Experiencia como distribuidor',
        fields: [
            { key: 'company', label: 'Nombre de la empresa', required: true },
            { key: 'seniority', label: 'Antigüedad', required: true },
            { key: 'customers', label: 'Número de clientes', required: true },
            { key: 'creditLine', label: 'Línea de crédito autorizada', placeholder: '$ 0.00', required: true }
        ],
        columns: ['company', 'seniority', 'customers', 'creditLine']
    },
    catalogExperience: {
        title: 'Experiencia de venta por catálogo',
        fields: [
            { key: 'company', label: 'Nombre de la empresa', required: true },
            { key: 'seniority', label: 'Antigüedad', required: true },
            { key: 'customers', label: 'Número de clientes', required: true },
            { key: 'creditLine', label: 'Línea de crédito autorizada', placeholder: '$ 0.00', required: true }
        ],
        columns: ['company', 'seniority', 'customers', 'creditLine']
    },
    beneficiaries: {
        title: 'Beneficiarios',
        fields: [
            { key: 'firstName', label: 'Primer nombre', required: true },
            { key: 'secondName', label: 'Segundo nombre' },
            { key: 'lastName', label: 'Apellido paterno', required: true },
            { key: 'motherName', label: 'Apellido materno', required: true },
            { key: 'relationship', label: 'Parentesco', required: true },
            { key: 'birthdate', label: 'Fecha de nacimiento', type: 'date' },
            { key: 'percentage', label: 'Porcentaje', placeholder: 'Porcentaje', type: 'number', max: 100, required: true }
        ],
        columns: ['firstName', 'secondName', 'lastName', 'motherName']
    },
    coinsured: {
        title: 'Coasegurados',
        fields: [
            { key: 'firstName', label: 'Primer nombre', required: true },
            { key: 'secondName', label: 'Segundo nombre' },
            { key: 'lastName', label: 'Apellido paterno', required: true },
            { key: 'motherName', label: 'Apellido materno', required: true },
            { key: 'relationship', label: 'Parentesco del Coasegurado', type: 'select', options: ['Cónyuge', 'Hijo(a)', 'Otro'], required: true },
            { key: 'birthdate', label: 'Fecha de nacimiento', type: 'date', required: true }
        ],
        columns: ['firstName', 'secondName', 'lastName', 'motherName']
    }
};

var recordTableRules = {
    references: {
        minComplete: 6,
        missingMessage: 'Debes capturar al menos 6 referencias personales o familiares completas.'
    },
    distributorExperience: {
        minComplete: 1,
        missingMessage: 'Debes capturar al menos 1 registro completo de experiencia como distribuidor.'
    },
    catalogExperience: {
        minComplete: 1,
        missingMessage: 'Debes capturar al menos 1 registro completo de experiencia de venta por catálogo.'
    },
    beneficiaries: {
        minComplete: 1,
        missingMessage: 'Debes capturar al menos 1 beneficiario completo.'
    },
    coinsured: {
        minComplete: 1,
        missingMessage: 'Debes capturar al menos 1 coasegurado completo.'
    }
};

['distributorExperience', 'catalogExperience'].forEach(function (type) {
    var seniority = recordDefinitions[type].fields.find(function (field) {
        return field.key === 'seniority';
    });
    if (seniority) {
        seniority.type = 'number';
    }
});

recordDefinitions.coinsured.fields.forEach(function (field) {
    if (field.key === 'relationship') {
        field.options = ['PAREJA', 'HIJO'];
    }
});

function setupRecordTables(state) {
    document.querySelectorAll('[data-open-record]').forEach(function (button) {
        button.addEventListener('click', function () {
            openRecordModal(button.dataset.openRecord, null, state);
        });
    });

    var recordForm = document.querySelector('[data-record-form]');
    if (recordForm) {
        recordForm.addEventListener('submit', function (event) {
            event.preventDefault();
            saveRecord(state);
        });
    }

    document.querySelectorAll('[data-record-close]').forEach(function (button) {
        button.addEventListener('click', closeRecordModal);
    });
    document.querySelectorAll('[data-delete-close]').forEach(function (button) {
        button.addEventListener('click', closeDeleteModal);
    });

    var deleteButton = document.querySelector('[data-delete-confirm]');
    if (deleteButton) {
        deleteButton.addEventListener('click', function () {
            if (!state.deletingRecord) {
                return;
            }
            state.records[state.deletingRecord.type].splice(state.deletingRecord.index, 1);
            renderRecordTable(state.deletingRecord.type, state);
            closeDeleteModal();
        });
    }
}

function openRecordModal(type, index, state) {
    var definition = recordDefinitions[type];
    var modal = document.querySelector('[data-record-modal]');
    var heading = document.querySelector('[data-record-modal-section]');
    var fields = document.querySelector('[data-record-fields]');
    var submit = document.querySelector('[data-record-submit]');
    var record = index === null ? {} : state.records[type][index];

    if (!definition || !modal || !heading || !fields || !submit) {
        return;
    }

    state.editingRecord = { type: type, index: index };
    heading.textContent = definition.title;
    submit.textContent = index === null ? 'Agregar' : 'Actualizar';
    fields.innerHTML = definition.fields.map(function (field) {
        return renderRecordField(field, record[field.key] || '');
    }).join('');
    fields.querySelectorAll('input[type="tel"]').forEach(function (input) {
        input.addEventListener('input', function () {
            input.value = input.value.replace(/\D/g, '').slice(0, 10);
        });
    });
    fields.querySelectorAll('input[data-record-number], input[data-record-max]').forEach(function (input) {
        input.addEventListener('input', function () {
            input.value = input.value.replace(/\D/g, '');
            validateRecordPercentage(fields, submit);
        });
    });
    validateRecordPercentage(fields, submit);

    if (type === 'distributorExperience') {
        fields.insertAdjacentHTML('afterend', buildActivityDocuments(record.ticketFiles || {}));
        bindRecordDocumentInputs(record.ticketFiles || {});
    } else if (type === 'catalogExperience') {
        fields.insertAdjacentHTML('afterend', buildActivityDocument(record.activityProof || []));
        bindRecordDocumentInputs({ activityProof: record.activityProof || [] });
    }

    modal.hidden = false;
    document.body.classList.add('has-form2-modal');
}

function renderRecordField(field, value) {
    var id = 'record-' + field.key;
    var required = field.required ? '<span class="required">*</span>' : '';
    var safeValue = escapeHtml(value);

    if (field.type === 'select') {
        return '<div class="form-group"><label for="' + id + '">' + field.label + required + '</label><select id="' + id + '" data-record-field="' + field.key + '"><option value="">Seleccione una opción</option>' +
            field.options.map(function (option) {
                return '<option' + (option === value ? ' selected' : '') + '>' + option + '</option>';
            }).join('') + '</select></div>';
    }

    var attributes = '';
    if (field.type === 'tel') {
        attributes = ' inputmode="numeric" maxlength="10"';
    }
    if (field.type === 'number') {
        attributes = ' inputmode="numeric" data-record-number="true"' + (field.max ? ' data-record-max="' + field.max + '"' : '');
    }

    return '<div class="form-group"><label for="' + id + '">' + field.label + required + '</label><input type="' +
        (field.type === 'number' ? 'text' : (field.type || 'text')) + '" id="' + id + '" data-record-field="' + field.key + '" value="' + safeValue + '"' + attributes +
        '" placeholder="' + escapeHtml(field.placeholder || field.label) + '">' +
        (field.max ? '<p class="field-error" data-record-field-error="' + field.key + '" hidden>El porcentaje no puede exceder el 100%.</p>' : '') +
        '</div>';
}

function validateRecordPercentage(container, submit) {
    var input = container && container.querySelector('[data-record-field="percentage"]');
    var error = container && container.querySelector('[data-record-field-error="percentage"]');
    var invalid = input && input.value && Number(input.value) > 100;

    if (error) {
        error.hidden = !invalid;
    }
    if (input) {
        input.classList.toggle('field-invalid', !!invalid);
        input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    }
    if (submit) {
        submit.disabled = !!invalid;
    }
}

function buildActivityDocument(files) {
    var fileList = normalizeRecordFiles(files);
    var hasFiles = fileList.length > 0;
    return '<div class="document-card document-card-inline form3-record-document" data-record-document="activityProof">' +
        '<div class="document-icon" aria-hidden="true">DOC</div>' +
        '<div class="document-copy"><h4>Comprobante de actividad</h4><p data-record-document-name>' +
        escapeHtml(formatRecordFileNames(fileList)) + '</p><button type="button" class="document-link" data-record-document-view' + (hasFiles ? '' : ' hidden') + '>Ver documento</button></div>' +
        '<span class="document-status ' + (hasFiles ? 'is-loaded' : 'is-pending') + '" data-record-document-status>' +
        (hasFiles ? 'Documento cargado' : 'Documento pendiente') + '</span>' +
        '<button type="button" class="btn-outline" data-record-document-upload>' + (hasFiles ? 'Volver a subir' : 'Subir') + '</button>' +
        '<input type="file" class="visually-hidden" multiple accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" data-record-document-file>' +
        '</div>';
}

function buildActivityDocuments(files) {
    return '<div class="form3-record-documents" data-record-documents>' +
        [1, 2, 3].map(function (index) {
            var key = 'ticket' + index;
            var fileList = normalizeRecordFiles(files && files[key]);
            var hasFiles = fileList.length > 0;
            return '<div class="document-card document-card-inline form3-record-document" data-record-document="' + key + '">' +
                '<div class="document-icon" aria-hidden="true">DOC</div>' +
                '<div class="document-copy"><h4>Relación y ticket ' + index + '</h4><p data-record-document-name>' +
                escapeHtml(formatRecordFileNames(fileList)) + '</p><button type="button" class="document-link" data-record-document-view' + (hasFiles ? '' : ' hidden') + '>Ver documento</button></div>' +
                '<span class="document-status ' + (hasFiles ? 'is-loaded' : 'is-pending') + '" data-record-document-status>' +
                (hasFiles ? 'Documento cargado' : 'Documento pendiente') + '</span>' +
                '<button type="button" class="btn-outline" data-record-document-upload>' + (hasFiles ? 'Volver a subir' : 'Subir') + '</button>' +
                '<input type="file" class="visually-hidden" multiple accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" data-record-document-file>' +
                '</div>';
        }).join('') +
        '</div>';
}

function bindRecordDocumentInputs(existingFiles) {
    document.querySelectorAll('[data-record-document]').forEach(function (card) {
        var upload = card && card.querySelector('[data-record-document-upload]');
        var input = card && card.querySelector('[data-record-document-file]');
        var view = card && card.querySelector('[data-record-document-view]');
        var key = card && card.dataset.recordDocument;

        if (!upload || !input) {
            return;
        }

        card._recordFiles = normalizeRecordFiles(existingFiles && existingFiles[key]);
        upload.addEventListener('click', function () {
            input.click();
        });
        input.addEventListener('change', function () {
            var files = Array.prototype.slice.call(input.files || []).filter(isAllowedDocument);
            var name = card.querySelector('[data-record-document-name]');
            var status = card.querySelector('[data-record-document-status]');
            if (!files.length) {
                return;
            }
            card._recordFiles = files.map(function (file) {
                return {
                    file: file,
                    name: file.name,
                    url: URL.createObjectURL(file)
                };
            });
            name.textContent = formatRecordFileNames(card._recordFiles);
            status.textContent = 'Documento cargado';
            status.classList.remove('is-pending');
            status.classList.add('is-loaded');
            upload.textContent = 'Volver a subir';
            if (view) {
                view.hidden = false;
            }
        });
        if (view) {
            view.addEventListener('click', function () {
                openRecordDocumentPreview(card._recordFiles || [], card.querySelector('h4').textContent);
            });
        }
    });
}

function normalizeRecordFiles(value) {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value.filter(function (item) {
            return item && (item.name || item.file);
        });
    }
    if (typeof value === 'string') {
        return value ? [{ name: value }] : [];
    }
    if (value.name || value.file) {
        return [value];
    }
    return [];
}

function formatRecordFileNames(files) {
    var list = normalizeRecordFiles(files);
    if (!list.length) {
        return '';
    }
    return list[0].name + (list.length > 1 ? ' +' + (list.length - 1) + ' archivo(s)' : '');
}

function hasRecordFiles(files) {
    return normalizeRecordFiles(files).length > 0;
}

function openRecordDocumentPreview(files, label) {
    var fileList = normalizeRecordFiles(files);
    var first = fileList[0];

    if (!first) {
        return;
    }

    openDocumentPreview({
        label: label,
        file: first.file || { name: first.name, type: '' },
        url: first.url || ''
    });
}

function saveRecord(state) {
    var editing = state.editingRecord;
    var definition = editing && recordDefinitions[editing.type];
    var modal = document.querySelector('[data-record-modal]');
    var record = {};

    if (!editing || !definition || !modal) {
        return;
    }

    if (modal.querySelector('[data-record-field="percentage"]') &&
        Number(modal.querySelector('[data-record-field="percentage"]').value || 0) > 100) {
        return;
    }

    modal.querySelectorAll('[data-record-field]').forEach(function (field) {
        record[field.dataset.recordField] = field.value.trim();
    });
    if (editing.type === 'distributorExperience') {
        var previousTickets = editing.index === null ? {} : state.records[editing.type][editing.index].ticketFiles || {};
        record.ticketFiles = {};
        modal.querySelectorAll('[data-record-document]').forEach(function (documentCard) {
            var key = documentCard.dataset.recordDocument;
            record.ticketFiles[key] = normalizeRecordFiles(documentCard._recordFiles || previousTickets[key]);
        });
    } else {
        var documentCard = modal.querySelector('[data-record-document]');
        if (documentCard) {
            record.activityProof = normalizeRecordFiles(documentCard._recordFiles ||
                (editing.index === null ? [] : state.records[editing.type][editing.index].activityProof || []));
        }
    }

    if (editing.index === null) {
        state.records[editing.type].push(record);
    } else {
        state.records[editing.type][editing.index] = record;
    }
    renderRecordTable(editing.type, state);
    closeRecordModal();
}

function renderRecordTable(type, state) {
    var table = document.querySelector('[data-record-table="' + type + '"]');
    var definition = recordDefinitions[type];
    var tbody = table && table.querySelector('tbody');
    var records = state.records[type];

    if (!tbody || !definition) {
        return;
    }

    if (!records.length) {
        tbody.innerHTML = '<tr><td colspan="5">Sin información</td></tr>';
        return;
    }

    tbody.innerHTML = records.map(function (record, index) {
        var columns = definition.columns.map(function (key) {
            return '<td>' + escapeHtml(record[key] || '') + '</td>';
        }).join('');
        return '<tr class="has-record">' + columns + '<td><div class="form3-row-actions">' +
            '<button type="button" class="form3-row-action" data-record-edit="' + type + '" data-record-index="' + index + '" aria-label="Editar">&#9998;</button>' +
            '<button type="button" class="form3-row-action" data-record-delete="' + type + '" data-record-index="' + index + '" aria-label="Eliminar">&#128465;</button>' +
            '</div></td></tr>';
    }).join('');

    tbody.querySelectorAll('[data-record-edit]').forEach(function (button) {
        button.addEventListener('click', function () {
            openRecordModal(button.dataset.recordEdit, Number(button.dataset.recordIndex), state);
        });
    });
    tbody.querySelectorAll('[data-record-delete]').forEach(function (button) {
        button.addEventListener('click', function () {
            openDeleteModal(button.dataset.recordDelete, Number(button.dataset.recordIndex), state);
        });
    });
}

function closeRecordModal() {
    var modal = document.querySelector('[data-record-modal]');
    var oldDocuments = modal && modal.querySelector('[data-record-documents]');
    var oldDocument = modal && modal.querySelector('[data-record-document]');
    if (oldDocuments) {
        oldDocuments.remove();
    } else if (oldDocument) {
        oldDocument.remove();
    }
    if (modal) {
        modal.hidden = true;
    }
    document.body.classList.remove('has-form2-modal');
}

function openDeleteModal(type, index, state) {
    var modal = document.querySelector('[data-delete-modal]');
    state.deletingRecord = { type: type, index: index };
    if (modal) {
        modal.hidden = false;
        document.body.classList.add('has-form2-modal');
    }
}

function closeDeleteModal() {
    var modal = document.querySelector('[data-delete-modal]');
    if (modal) {
        modal.hidden = true;
    }
    document.body.classList.remove('has-form2-modal');
}

function setupDocuments(state) {
    document.querySelectorAll('[data-form3-document]').forEach(function (card) {
        var key = card.dataset.form3Document;
        var upload = card.querySelector('[data-document-upload]');
        var fileInput = card.querySelector('[data-document-file]');
        var view = card.querySelector('[data-document-view]');

        if (upload && fileInput) {
            upload.addEventListener('click', function () {
                fileInput.click();
            });
            fileInput.addEventListener('change', function () {
                var file = fileInput.files && fileInput.files[0];
                if (!file || !isAllowedDocument(file)) {
                    return;
                }
                revokeDocumentUrl(state.documents[key]);
                state.documents[key] = {
                    file: file,
                    label: card.dataset.documentLabel,
                    url: URL.createObjectURL(file)
                };
                renderDocumentState(card, state.documents[key]);
            });
        }

        if (view) {
            view.addEventListener('click', function () {
                if (state.documents[key]) {
                    openDocumentPreview(state.documents[key]);
                }
            });
        }
    });
}

function isAllowedDocument(file) {
    return /(\.jpg|\.jpeg|\.png|\.pdf)$/i.test(file.name) ||
        ['image/jpeg', 'image/png', 'application/pdf'].indexOf(file.type) >= 0;
}

function revokeDocumentUrl(documentState) {
    if (documentState && documentState.url) {
        URL.revokeObjectURL(documentState.url);
    }
}

function renderDocumentState(card, documentState) {
    var status = card.querySelector('[data-document-status]');
    var upload = card.querySelector('[data-document-upload]');
    var view = card.querySelector('[data-document-view]');
    var loaded = !!documentState;

    if (status) {
        status.textContent = loaded ? 'Documento cargado' : 'Documento pendiente';
        status.classList.toggle('is-pending', !loaded);
        status.classList.toggle('is-loaded', loaded);
    }
    if (upload) {
        upload.textContent = loaded ? 'Volver a subir' : 'Subir';
    }
    if (view) {
        view.hidden = !loaded;
    }
}

function setupPreviewModal() {
    document.querySelectorAll('[data-form3-preview-close]').forEach(function (button) {
        button.addEventListener('click', closeDocumentPreview);
    });
}

function setupPrintState() {
    window.addEventListener('afterprint', function () {
        document.body.classList.remove('is-printing-form3');
    });
}

function openDocumentPreview(documentState) {
    var modal = document.querySelector('[data-form3-preview-modal]');
    var title = document.querySelector('[data-form3-preview-title]');
    var content = document.querySelector('[data-form3-preview-content]');

    if (!modal || !title || !content) {
        return;
    }

    title.textContent = documentState.label;
    content.innerHTML = '';
    if (documentState.file.type.indexOf('image/') === 0) {
        var image = document.createElement('img');
        image.src = documentState.url;
        image.alt = documentState.label;
        content.appendChild(image);
    } else {
        content.textContent = documentState.file.name + ' - documento PDF cargado localmente.';
    }
    modal.hidden = false;
    document.body.classList.add('has-form2-modal');
}

function closeDocumentPreview() {
    var modal = document.querySelector('[data-form3-preview-modal]');
    if (modal) {
        modal.hidden = true;
    }
    document.body.classList.remove('has-form2-modal');
}

function renderFeedback(state) {
    var result = document.querySelector('[data-form3-result]');
    var allMetrics = [1, 2, 3, 4].map(function (step) {
        return getStepMetrics(step, state);
    });
    var totals = combineMetrics(allMetrics);
    var correctPercent = totals.total ? Math.round(totals.correct / totals.total * 100) : 0;
    var collaboratorName = getValueById('form3-practice-collaborator') || 'colaborador en capacitacion';
    var branch = getValueById('form3-practice-branch') || 'Sin capturar';
    var practiceId = getValueById('form3-practice-id') || 'Sin capturar';

    if (!result) {
        return;
    }

    applyForm3FieldStates(allMetrics);

    var practiceSummary = '<div class="result-header form3-practice-feedback">' +
        '<p>Gracias, ' + escapeHtml(collaboratorName) + '.</p>' +
        '<p>Sucursal: ' + escapeHtml(branch) + ' - ID: ' + escapeHtml(practiceId) + '</p>' +
        '<p>' + escapeHtml(getPerformanceMessage(correctPercent)) + '</p>' +
        '</div>';

    result.innerHTML = [
        '<div class="result-header form3-result-summary">',
        '<h2>Resultado de práctica - Formulario 3</h2>',
        '<p>Resumen de validación total del flujo de cuatro pasos.</p>',
        '</div>',
        practiceSummary,
        buildResultGrid(totals),
        '<div class="form3-result-tabs" role="tablist">',
        allMetrics.map(function (metrics, index) {
            return '<button type="button" class="form3-result-tab' + (index === 0 ? ' is-active' : '') +
                '" data-form3-result-tab="' + metrics.step + '" role="tab">Paso ' + metrics.step + '</button>';
        }).join(''),
        '</div>',
        allMetrics.map(function (metrics, index) {
            return buildStepResultPanel(metrics, index !== 0);
        }).join(''),
        '<button type="button" class="btn-primary btn-print" data-form3-print>Imprimir resultado</button>'
    ].join('');

    result.hidden = false;
    document.body.classList.add('is-result');
    setupFeedbackTabs(result);
    result.querySelector('[data-form3-print]').addEventListener('click', function () {
        document.body.classList.add('is-printing-form3');
        window.print();
    });
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function applyForm3FieldStates(allMetrics) {
    document.querySelectorAll('.form3-page input, .form3-page select').forEach(function (control) {
        control.classList.remove('field-valid', 'field-invalid');
        control.removeAttribute('aria-invalid');
    });

    allMetrics.forEach(function (metrics) {
        (metrics.results || []).forEach(function (result) {
            if (!result.id) {
                return;
            }
            var control = document.getElementById(result.id);
            if (!control || control.disabled) {
                return;
            }
            control.classList.toggle('field-valid', result.valid && result.filled);
            control.classList.toggle('field-invalid', !result.valid);
            if (!result.valid) {
                control.setAttribute('aria-invalid', 'true');
            }
        });
    });
}

function getStepMetrics(step, state) {
    var panel = document.querySelector('[data-form3-step-panel="' + step + '"]');
    if (step > 1 && !state.optionalSteps[step]) {
        return {
            step: step,
            total: 0,
            filled: 0,
            empty: 0,
            incorrect: 0,
            correctRequired: 0,
            correct: [],
            pending: [],
            disabled: true
        };
    }

    var controls = Array.prototype.slice.call(panel.querySelectorAll('input:not([type="file"]), select')).filter(function (control) {
        return !control.hasAttribute('data-optional') &&
            !control.hasAttribute('data-form3-step-toggle') &&
            !hasOptionalSectionAncestor(control, panel) &&
            !control.hidden &&
            !hasHiddenAncestor(control, panel);
    });
    var results = [];

    if (step === 1) {
        controls = Array.prototype.slice.call(document.querySelectorAll('[data-form3-practice-field]')).concat(controls);
    }

    controls.forEach(function (control) {
        results.push(validateControl(control));
    });

    Array.prototype.slice.call(panel.querySelectorAll('input[data-optional], select[data-optional]')).forEach(function (control) {
        if (!control.hidden && !hasHiddenAncestor(control, panel) && String(control.value || '').trim()) {
            results.push(validateControl(control, true));
        }
    });

    panel.querySelectorAll('[data-form3-document]').forEach(function (card) {
        var label = card.dataset.documentLabel;
        var required = !card.hasAttribute('data-optional-document');
        var loaded = !!state.documents[card.dataset.form3Document];
        results.push({
            label: label,
            required: required,
            valid: loaded,
            filled: loaded,
            message: loaded ? '' : (required ? 'Documento pendiente.' : 'Documento opcional no cargado.')
        });
    });

    panel.querySelectorAll('[data-optional-section]').forEach(function (section) {
        if (!hasHiddenAncestor(section, panel)) {
            results.push(validateOptionalSection(section, panel));
        }
    });

    if (step === 1) {
        panel.querySelectorAll('[data-record-table]').forEach(function (table) {
            if (hasHiddenAncestor(table, panel)) {
                return;
            }
            var label = table.dataset.tableLabel;
            results = results.concat(validateRecordTable(table.dataset.recordTable, label, state));
        });

        if (getValueById('distributor-experience') === 'No') {
            results.push(validResult('Experiencia como distribuidor / venta por catálogo: No aplica', '', false));
        }
    }

    var correct = results.filter(function (result) { return result.valid; });
    var pending = results.filter(function (result) { return !result.valid; });
    var requiredResults = results.filter(function (result) { return result.required; });
    var correctRequired = requiredResults.filter(function (result) { return result.valid; });

    return {
        step: step,
        total: requiredResults.length,
        filled: requiredResults.filter(function (result) { return result.filled; }).length,
        empty: requiredResults.filter(function (result) { return !result.filled; }).length,
        incorrect: requiredResults.length - correctRequired.length,
        correctRequired: correctRequired.length,
        correct: correct,
        pending: pending,
        results: results
    };
}

function validateControl(control, optionalOverride) {
    var label = getControlLabel(control);
    var value = String(control.value || '').trim();
    var required = !optionalOverride && !control.hasAttribute('data-optional');

    function ok() {
        return validResult(label, control.id, required);
    }

    function fail(filled, message) {
        return invalidResult(label, filled, message, control.id, required);
    }

    if (!required && !value) {
        return { id: control.id, label: label, required: false, valid: true, filled: false, message: '' };
    }

    if (!value) {
        return { id: control.id, label: label, required: required, valid: false, filled: false, message: control.tagName === 'SELECT' ? 'Debes seleccionar una opción.' : 'Campo pendiente de captura.' };
    }

    if (control.id === 'advance-payments' || control.id === 'early-payoff') {
        return value === 'No' ?
            ok() :
            fail(true, 'Selecciona la opción No para la práctica.');
    }

    if (isTransactionalNeutralField(control)) {
        if (isTransactionalProfileNo()) {
            return isZeroLike(value) ?
                ok() :
                fail(true, 'Captura 0 o $ 0.00 para la práctica.');
        }
    }

    if (isTransactionalOptionalField(control) && isTransactionalProfileNo()) {
        return ok();
    }

    if (control.tagName === 'SELECT') {
        return { id: control.id, label: label, required: required, valid: true, filled: true, message: '' };
    }

    if (control.id === 'form3-practice-id') {
        return /^\d{1,6}$/.test(value) ?
            ok() :
            fail(true, 'Ingresa un ID numérico de máximo 6 dígitos.');
    }

    if (isPhoneField(control)) {
        return /^\d{10}$/.test(value) ?
            ok() :
            fail(true, 'Ingresa un número telefónico válido de 10 dígitos.');
    }

    if (isPostalField(control)) {
        return /^\d{5}$/.test(value) ?
            ok() :
            fail(true, 'Ingresa un C.P. válido de 5 dígitos.');
    }

    if (isRfcField(control)) {
        return /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(value) ?
            ok() :
            fail(true, 'Ingresa un RFC válido en MAYÚSCULAS, máximo 13 caracteres.');
    }

    if ((control.id || '').indexOf('curp') >= 0) {
        return /^[A-Z0-9]{18}$/.test(value) ?
            ok() :
            fail(true, 'Ingresa una CURP válida de 18 caracteres en MAYÚSCULAS.');
    }

    if (control.type === 'email') {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ?
            ok() :
            fail(true, 'Ingresa un correo electrónico válido.');
    }

    if (control.type === 'date') {
        return value ? ok() : fail(false, 'Campo pendiente de captura.');
    }

    if (isAmountField(control)) {
        return parseMoney(value) >= 0 ?
            ok() :
            fail(true, 'Ingresa un monto válido.');
    }

    if (isNumericField(control)) {
        return /^\d+$/.test(value) ?
            ok() :
            fail(true, 'Ingresa un valor numérico válido.');
    }

    if (isPracticeField(control)) {
        return value.length >= 2 && value.length <= 50 ?
            ok() :
            fail(true, 'Ingresa entre 2 y 50 caracteres.');
    }

    if (control.readOnly && isAddressCatalogField(control)) {
        return ok();
    }

    if (value !== value.toUpperCase()) {
        return fail(true, 'Captura este campo en MAYÚSCULAS para que sea correcto.');
    }

    return ok();
}

function validateRecordTable(type, label, state) {
    var records = state.records[type] || [];
    var rule = recordTableRules[type] || { minComplete: 1, missingMessage: 'Debes capturar al menos 1 registro completo.' };
    var completeCount = records.filter(function (record) {
        return isRecordComplete(type, record);
    }).length;
    var results = [];

    if (completeCount < rule.minComplete) {
        results.push(invalidResult(label, records.length > 0, rule.missingMessage));
    } else {
        results.push(validResult(label + ': registros completos'));
    }

    records.forEach(function (record, index) {
        var definition = recordDefinitions[type];
        var prefix = label + ' registro ' + (index + 1) + ' - ';

        definition.fields.forEach(function (field) {
            var value = String(record[field.key] || '').trim();
            var fieldLabel = prefix + field.label;

            if (field.required && !value) {
                results.push(invalidResult(fieldLabel, false, 'Campo pendiente de captura.'));
                return;
            }

            if (!value) {
                return;
            }

            if (field.type === 'tel' && !/^\d{10}$/.test(value)) {
                results.push(invalidResult(fieldLabel, true, 'Ingresa un número telefónico válido de 10 dígitos.'));
                return;
            }

            if (field.type === 'number' && (!/^\d+$/.test(value) || (field.max && Number(value) > field.max))) {
                results.push(invalidResult(fieldLabel, true, field.max ? 'El porcentaje no puede exceder el 100%.' : 'Ingresa un valor numérico válido.'));
                return;
            }

            if (field.type === 'select') {
                results.push(validResult(fieldLabel));
                return;
            }

            if (field.type !== 'date' && value !== value.toUpperCase()) {
                results.push(invalidResult(fieldLabel, true, 'Captura este campo en MAYÚSCULAS para que sea correcto.'));
                return;
            }

            results.push(validResult(fieldLabel));
        });

        if (type === 'distributorExperience') {
            ['ticket1', 'ticket2', 'ticket3'].forEach(function (key, ticketIndex) {
                if (!hasRecordFiles(record.ticketFiles && record.ticketFiles[key])) {
                    results.push(invalidResult(prefix + 'Relación y ticket ' + (ticketIndex + 1), false, 'Documento pendiente.'));
                } else {
                    results.push(validResult(prefix + 'Relación y ticket ' + (ticketIndex + 1)));
                }
            });
        }
        if (type === 'catalogExperience') {
            if (!hasRecordFiles(record.activityProof)) {
                results.push(invalidResult(prefix + 'Comprobante de actividad', false, 'Documento pendiente.'));
            } else {
                results.push(validResult(prefix + 'Comprobante de actividad'));
            }
        }
    });

    return results;
}

function isRecordComplete(type, record) {
    var definition = recordDefinitions[type];

    if (!definition) {
        return false;
    }

    var fieldsComplete = definition.fields.every(function (field) {
        var value = String(record[field.key] || '').trim();

        if (!field.required && !value) {
            return true;
        }

        if (field.required && !value) {
            return false;
        }

        if (field.type === 'tel') {
            return /^\d{10}$/.test(value);
        }

        if (field.type === 'select') {
            return !!value;
        }

        if (field.type === 'date') {
            return !!value;
        }

        if (field.type === 'number') {
            return /^\d+$/.test(value) && (!field.max || Number(value) <= field.max);
        }

        return value === value.toUpperCase();
    });

    if (!fieldsComplete) {
        return false;
    }

    if (type === 'distributorExperience') {
        return !!(record.ticketFiles &&
            hasRecordFiles(record.ticketFiles.ticket1) &&
            hasRecordFiles(record.ticketFiles.ticket2) &&
            hasRecordFiles(record.ticketFiles.ticket3));
    }

    if (type === 'catalogExperience') {
        return hasRecordFiles(record.activityProof);
    }

    return true;
}

function getValueById(id) {
    var control = document.getElementById(id);
    return control ? control.value : '';
}

function validResult(label, id, required) {
    return { id: id || '', label: label, required: required !== false, valid: true, filled: true, message: '' };
}

function invalidResult(label, filled, message, id, required) {
    return { id: id || '', label: label, required: required !== false, valid: false, filled: filled, message: message };
}

function isPracticeField(control) {
    return control.hasAttribute('data-form3-practice-field');
}

function isPhoneField(control) {
    var id = control.id || '';
    return control.type === 'tel' || id.indexOf('phone') >= 0 || id.indexOf('celular') >= 0;
}

function isPostalField(control) {
    var id = control.id || '';
    return id.indexOf('postal') >= 0;
}

function isRfcField(control) {
    var id = control.id || '';
    return id.indexOf('rfc') >= 0;
}

function isAmountField(control) {
    var id = control.id || '';
    var placeholder = control.getAttribute('placeholder') || '';
    return id.indexOf('income') >= 0 ||
        id.indexOf('amount') >= 0 ||
        id.indexOf('min') >= 0 ||
        id.indexOf('max') >= 0 ||
        id.indexOf('credit-line') >= 0 ||
        placeholder.indexOf('$') >= 0;
}

function isTransactionalProfileNo() {
    var advancePayments = document.getElementById('advance-payments');
    var earlyPayoff = document.getElementById('early-payoff');
    return (!advancePayments || advancePayments.value === 'No') &&
        (!earlyPayoff || earlyPayoff.value === 'No');
}

function isTransactionalNeutralField(control) {
    return ['advance-count', 'advance-min', 'advance-max'].indexOf(control.id) >= 0;
}

function isTransactionalOptionalField(control) {
    return ['advance-frequency', 'payment-instrument'].indexOf(control.id) >= 0;
}

function isZeroLike(value) {
    return parseMoney(value) === 0;
}

function validateOptionalSection(section, panel) {
    var label = section.dataset.optionalSection || 'Seccion opcional';
    var controls = Array.prototype.slice.call(section.querySelectorAll('input:not([type="file"]), select')).filter(function (control) {
        return !control.hidden && !hasHiddenAncestor(control, panel);
    });
    var filledControls = controls.filter(function (control) {
        return String(control.value || '').trim();
    });

    if (!filledControls.length) {
        return invalidResult(label, false, 'Opcional incompleto: no se capturo informacion.', '', false);
    }

    var allValid = controls.every(function (control) {
        var value = String(control.value || '').trim();

        if (!value) {
            return false;
        }

        return validateControl(control, true).valid;
    });

    return allValid ?
        validResult(label + ': opcional completo', '', false) :
        invalidResult(label, true, 'Opcional incompleto: completa todos sus campos con formato valido.', '', false);
}

function isNumericField(control) {
    var id = control.id || '';
    return id.indexOf('years') >= 0 ||
        id.indexOf('dependents') >= 0 ||
        id === 'advance-count' ||
        id.indexOf('percentage') >= 0 ||
        id.indexOf('customers') >= 0;
}

function isAddressCatalogField(control) {
    var id = control.id || '';
    return id.indexOf('municipality') >= 0 ||
        id.indexOf('city') >= 0 ||
        id.indexOf('state') >= 0 ||
        id.indexOf('country') >= 0;
}

function parseMoney(value) {
    var number = Number(String(value || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(number) ? number : -1;
}

function hasHiddenAncestor(control, panel) {
    var node = control.parentElement;
    while (node && node !== panel) {
        if (node.hidden) {
            return true;
        }
        node = node.parentElement;
    }
    return false;
}

function hasOptionalSectionAncestor(control, panel) {
    var node = control.parentElement;
    while (node && node !== panel) {
        if (node.hasAttribute && node.hasAttribute('data-optional-section')) {
            return true;
        }
        node = node.parentElement;
    }
    return false;
}

function getControlLabel(control) {
    if (control && control.dataset.manualNeighborhood) {
        control = document.getElementById(control.dataset.manualNeighborhood) || control;
    }
    var label = document.querySelector('label[for="' + control.id + '"]');
    return label ? label.textContent.trim() : control.id;
}

function combineMetrics(metrics) {
    return metrics.reduce(function (total, step) {
        total.total += step.total;
        total.filled += step.filled;
        total.empty += step.empty;
        total.correct += step.correctRequired || 0;
        total.incorrect += step.incorrect || 0;
        return total;
    }, { total: 0, filled: 0, empty: 0, correct: 0, incorrect: 0 });
}

function buildResultGrid(metrics) {
    var fillPercent = metrics.total ? Math.round(metrics.filled / metrics.total * 100) : 0;
    var correctPercent = metrics.total ? Math.round(metrics.correct / metrics.total * 100) : 0;
    return '<div class="result-grid">' +
        metricBlock('Campos requeridos', metrics.total) +
        metricBlock('Campos llenados', metrics.filled) +
        metricBlock('Campos vacíos', metrics.empty) +
        metricBlock('Campos correctos', metrics.correct) +
        metricBlock('Campos incorrectos', metrics.incorrect) +
        metricBlock('Porcentaje de llenado', fillPercent + '%') +
        metricBlock('Porcentaje correcto', correctPercent + '%') +
        '</div>';
}

function metricBlock(label, value) {
    return '<div><strong>' + label + '</strong><span>' + value + '</span></div>';
}

function getPerformanceMessage(percent) {
    if (percent >= 90) {
        return 'Excelente.';
    }
    if (percent >= 75) {
        return 'Buen avance.';
    }
    if (percent >= 60) {
        return 'Requiere reforzamiento.';
    }
    return 'Se recomienda repetir la practica.';
}

function buildStepResultPanel(metrics, hidden) {
    var percentage = metrics.total ? Math.round((metrics.correctRequired || 0) / metrics.total * 100) : 0;
    var correctRequired = (metrics.correct || []).filter(function (item) { return item.required !== false; });
    var pendingRequired = (metrics.pending || []).filter(function (item) { return item.required !== false; });
    var optionalComplete = (metrics.correct || []).filter(function (item) { return item.required === false; });
    var optionalIncomplete = (metrics.pending || []).filter(function (item) { return item.required === false; });
    var note = metrics.step === 1 ?
        '<p class="form3-step-note">En la seccion Perfil transaccional ambos campos select deben ir con la opcion No y los valores en 0</p>' :
        '';
    var disabledNote = metrics.disabled ?
        '<p class="form3-step-note">Paso opcional no habilitado. No suma campos pendientes ni afecta el resultado general.</p>' :
        '';
    return '<section class="form3-result-panel" data-form3-result-panel="' + metrics.step + '"' + (hidden ? ' hidden' : '') + '>' +
        '<h3 class="form3-result-step-title">Paso ' + metrics.step + '</h3>' +
        disabledNote +
        '<div class="result-grid">' +
        metricBlock('Campos del Paso ' + metrics.step, metrics.total) +
        metricBlock('Campos llenados', metrics.filled) +
        metricBlock('Campos vacíos', metrics.empty) +
        metricBlock('Porcentaje correcto', percentage + '%') +
        '</div>' +
        '<div class="result-lists"><div><h3>Campos correctos</h3>' + buildList(correctRequired, 'Sin campos llenados.') +
        '</div><div><h3>Campos por revisar</h3>' + buildList(pendingRequired, 'Sin campos pendientes.') +
        '</div><div><h3>Opcionales completos</h3>' + buildList(optionalComplete, 'Sin opcionales completos.') +
        '</div><div><h3>Opcionales incompletos</h3>' + buildList(optionalIncomplete, 'Sin opcionales incompletos.') + '</div></div>' +
        note + '</section>';
}

function buildList(items, emptyMessage) {
    if (!items.length) {
        return '<p>' + emptyMessage + '</p>';
    }
    return '<ul>' + items.map(function (item) {
        if (typeof item === 'string') {
            return '<li>' + escapeHtml(item) + '</li>';
        }
        return '<li>' + escapeHtml(item.label) + (item.message ? ': ' + escapeHtml(item.message) : '') + '</li>';
    }).join('') + '</ul>';
}

function setupFeedbackTabs(result) {
    result.querySelectorAll('[data-form3-result-tab]').forEach(function (button) {
        button.addEventListener('click', function () {
            var step = button.dataset.form3ResultTab;
            result.querySelectorAll('[data-form3-result-tab]').forEach(function (tab) {
                tab.classList.toggle('is-active', tab === button);
            });
            result.querySelectorAll('[data-form3-result-panel]').forEach(function (panel) {
                panel.hidden = panel.dataset.form3ResultPanel !== step;
            });
        });
    });
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[character];
    });
}
