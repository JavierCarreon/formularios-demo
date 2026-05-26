document.addEventListener('DOMContentLoaded', function () {
    var state = {
        attemptedFinalize: false,
        ineConfirmed: false,
        ine: {
            front: null,
            back: null
        },
        proof: null,
        selfieValidated: false,
        nipConfirmed: false,
        camera: {
            mode: '',
            target: '',
            stream: null,
            imageData: ''
        },
        addressManualMode: false,
        lastMetrics: null
    };

    var postalCatalog = {
        '82140': {
            colonias: ['Estadio', 'Telleria', 'Ferrocarrilera'],
            municipio: 'Mazatlán',
            ciudad: 'Mazatlán',
            estado: 'Sinaloa',
            pais: 'México'
        },
        '34000': {
            colonias: ['Zona Centro', 'Analco'],
            municipio: 'Durango',
            ciudad: 'Durango',
            estado: 'Durango',
            pais: 'México'
        }
    };

    setupGlobalModalClose();
    setupInputLimits();
    setupPostalCode(postalCatalog, state);
    setupIneModal(state);
    setupProofDocument(state);
    setupSelfieState(state);
    setupCameraModal(state);
    setupNipInputs(state);
    setupFormState(state);
    setupFeedbackPrintState();
});

function setupFeedbackPrintState() {
    window.addEventListener('afterprint', function () {
        document.body.classList.remove('is-printing-feedback');
    });
}

function setupFormState(state) {
    var inputs = Array.prototype.slice.call(document.querySelectorAll('.form2-page input, .form2-page select'));
    var finalizeButton = document.querySelector('[data-form2-finalize]');
    var showFeedbackButton = document.querySelector('[data-show-feedback]');

    inputs.forEach(function (input) {
        input.addEventListener('input', function () {
            if (input.matches('[data-nip-input]')) {
                state.nipConfirmed = false;
                renderNipConfirmed(state);
            }

            updateFinalState(state, false);
        });

        input.addEventListener('change', function () {
            if (input.id === 'credit-terms') {
                state.nipConfirmed = false;
                renderNipConfirmed(state);
                updateNipSendState(state);
            }

            updateFinalState(state, false);
        });
    });

    if (finalizeButton) {
        finalizeButton.addEventListener('click', function () {
            state.attemptedFinalize = true;

            var metrics = validateForm2(state, true);
            var completion = getCompletionState(state, metrics);
            metrics.allValid = completion.allComplete;
            state.lastMetrics = metrics;

            if (!metrics.allValid) {
                updateFinalState(state, true);
                focusFirstInvalid();
                return;
            }

            renderFinalFeedback(metrics);
            showSuccessScreen();
        });
    }

    if (showFeedbackButton) {
        showFeedbackButton.addEventListener('click', function () {
            var panel = document.getElementById('form2-practice-result');

            if (panel) {
                panel.hidden = false;
                panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    updateFinalState(state, false);
}

function setupInputLimits() {
    [
        { id: 'rfc', max: 10 },
        { id: 'rfc-homoclave', max: 3 },
        { id: 'prospect-rfc', max: 13 }
    ].forEach(function (item) {
        var input = document.getElementById(item.id);

        if (!input) {
            return;
        }

        input.maxLength = item.max;
        input.addEventListener('input', function () {
            input.value = input.value.toUpperCase().slice(0, item.max);
        });
    });

    var practiceId = document.getElementById('form2-practice-id');
    var postalCode = document.getElementById('postal-code');

    [practiceId, postalCode].forEach(function (input) {
        if (!input) {
            return;
        }

        input.addEventListener('input', function () {
            input.value = input.value.replace(/\D/g, '').slice(0, input.maxLength || 6);
        });
    });
}

function setupPostalCode(postalCatalog, state) {
    var postalCode = document.getElementById('postal-code');

    if (!postalCode) {
        return;
    }

    postalCode.addEventListener('input', function () {
        var cp = postalCode.value.trim();

        if (cp.length === 5) {
            applyPostalCatalog(cp, postalCatalog, state);
        } else {
            state.addressManualMode = false;
            var neighborhood = document.getElementById('neighborhood');
            var manualNeighborhood = document.getElementById('neighborhood-manual');
            if (neighborhood) {
                neighborhood.hidden = false;
            }
            if (manualNeighborhood) {
                manualNeighborhood.hidden = true;
                manualNeighborhood.value = '';
            }
            clearPostalAutofill();
        }

        updateFinalState(state, false);
    });
}

function applyPostalCatalog(cp, postalCatalog, state) {
    var data = postalCatalog[cp];
    var neighborhood = document.getElementById('neighborhood');
    var manualNeighborhood = document.getElementById('neighborhood-manual');

    if (!neighborhood) {
        return;
    }

    neighborhood.innerHTML = '<option value="">Seleccione una opción</option>';

    if (!data) {
        state.addressManualMode = true;
        neighborhood.hidden = true;
        neighborhood.value = '';
        if (manualNeighborhood) {
            manualNeighborhood.hidden = false;
            manualNeighborhood.value = '';
        }
        clearPostalAutofill();
        setFieldError(document.getElementById('postal-code'), '', true);
        return;
    }

    state.addressManualMode = false;
    neighborhood.hidden = false;
    if (manualNeighborhood) {
        manualNeighborhood.hidden = true;
        manualNeighborhood.value = '';
    }

    data.colonias.forEach(function (colonia) {
        var option = document.createElement('option');
        option.value = colonia;
        option.textContent = colonia;
        neighborhood.appendChild(option);
    });

    setValue('municipality', data.municipio);
    setValue('city', data.ciudad);
    setValue('state', data.estado);
    setValue('country', data.pais);
    setFieldError(document.getElementById('postal-code'), '', true);
}

function clearPostalAutofill() {
    var neighborhood = document.getElementById('neighborhood');
    var manualNeighborhood = document.getElementById('neighborhood-manual');

    if (neighborhood) {
        neighborhood.innerHTML = '<option value="">Seleccione una opción</option>';
    }
    if (manualNeighborhood && !manualNeighborhood.hidden) {
        manualNeighborhood.value = '';
    }

    ['municipality', 'city', 'state', 'country'].forEach(function (id) {
        setValue(id, '');
    });
}

function setupIneModal(state) {
    var openButton = document.querySelector('[data-open-ine]');
    var continueButton = document.querySelector('[data-ine-continue]');

    if (openButton) {
        openButton.addEventListener('click', function () {
            openModal('ine');
        });
    }

    ['front', 'back'].forEach(function (side) {
        var uploadButton = document.querySelector('[data-ine-upload="' + side + '"]');
        var fileInput = document.querySelector('[data-ine-file="' + side + '"]');
        var cameraButton = document.querySelector('[data-ine-camera="' + side + '"]');

        if (uploadButton && fileInput) {
            uploadButton.addEventListener('click', function () {
                fileInput.click();
            });

            fileInput.addEventListener('change', function () {
                var file = fileInput.files && fileInput.files[0];

                if (!file) {
                    return;
                }

                if (!isAllowedDocument(file)) {
                    showModalMessage('ine', 'El archivo seleccionado no es compatible.');
                    return;
                }

                setDocumentState(state.ine, side, file, side === 'front' ? 'Frente de INE' : 'Reverso de INE');
                renderIneSide(state, side);
                updateIneModalState(state);
                updateFinalState(state, false);
            });
        }

        if (cameraButton) {
            cameraButton.addEventListener('click', function () {
                openCamera(state, 'ine', side);
            });
        }
    });

    if (continueButton) {
        continueButton.addEventListener('click', function () {
            if (!state.ine.front || !state.ine.back) {
                showModalMessage('ine', 'Carga frente y reverso de la INE para continuar.');
                return;
            }

            state.ineConfirmed = true;
            closeModal('ine');
            renderIneMainState(state);
            setSectionMessage('ine', '', true);
            updateFinalState(state, false);
        });
    }
}

function setupProofDocument(state) {
    var uploadButton = document.querySelector('[data-proof-upload]');
    var fileInput = document.querySelector('[data-proof-file]');
    var viewButton = document.querySelector('[data-proof-view]');

    if (uploadButton && fileInput) {
        uploadButton.addEventListener('click', function () {
            fileInput.click();
        });

        fileInput.addEventListener('change', function () {
            var file = fileInput.files && fileInput.files[0];

            if (!file) {
                return;
            }

            if (!isAllowedDocument(file)) {
                setSectionMessage('proof', 'El archivo seleccionado no es compatible.', false);
                return;
            }

            state.proof = createStoredFile(file, 'Comprobante de domicilio');
            renderProofState(state);
            updateFinalState(state, false);
        });
    }

    if (viewButton) {
        viewButton.addEventListener('click', function () {
            if (state.proof) {
                renderPreviewModal(state.proof);
            }
        });
    }
}

function setupSelfieState(state) {
    var selfieCard = document.querySelector('[data-selfie-card]');

    if (!selfieCard) {
        return;
    }

    var uploadButton = selfieCard.querySelector('[data-selfie-upload]');
    var fileInput = selfieCard.querySelector('[data-selfie-file]');
    var takePhotoButton = selfieCard.querySelector('[data-selfie-validate]');
    var validateAgainButton = selfieCard.querySelector('[data-selfie-validate-again]');

    if (takePhotoButton) {
        takePhotoButton.addEventListener('click', function () {
            openCamera(state, 'selfie', 'selfie');
        });
    }

    if (uploadButton && fileInput) {
        uploadButton.addEventListener('click', function () {
            fileInput.click();
        });

        fileInput.addEventListener('change', function () {
            var file = fileInput.files && fileInput.files[0];

            if (!file) {
                return;
            }

            if (!isAllowedSelfie(file)) {
                setSectionMessage('selfie', 'El archivo seleccionado no es compatible. Usa JPG, JPEG o PNG.', false);
                return;
            }

            startSelfieProcessing(state);
        });
    }

    if (validateAgainButton) {
        validateAgainButton.addEventListener('click', function () {
            state.selfieValidated = false;
            renderSelfieState('initial');
            updateFinalState(state, false);
        });
    }
}

function setupCameraModal(state) {
    var captureButton = document.querySelector('[data-camera-capture]');
    var retakeButton = document.querySelector('[data-camera-retake]');
    var continueButton = document.querySelector('[data-camera-continue]');
    var cancelButtons = Array.prototype.slice.call(document.querySelectorAll('[data-camera-cancel]'));

    cancelButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            closeCamera(state);
        });
    });

    if (captureButton) {
        captureButton.addEventListener('click', function () {
            captureCameraImage(state);
        });
    }

    if (retakeButton) {
        retakeButton.addEventListener('click', function () {
            resetCameraCapture(state);
        });
    }

    if (continueButton) {
        continueButton.addEventListener('click', function () {
            if (!state.camera.imageData) {
                return;
            }

            if (state.camera.mode === 'ine') {
                setDocumentState(state.ine, state.camera.target, {
                    name: state.camera.target === 'front' ? 'foto-ine-frente.png' : 'foto-ine-reverso.png',
                    type: 'image/png',
                    dataUrl: state.camera.imageData
                }, state.camera.target === 'front' ? 'Frente de INE' : 'Reverso de INE');
                renderIneSide(state, state.camera.target);
                updateIneModalState(state);
                closeCamera(state);
                return;
            }

            if (state.camera.mode === 'selfie') {
                closeCamera(state);
                startSelfieProcessing(state);
            }
        });
    }
}

function setupNipInputs(state) {
    var nipInputs = Array.prototype.slice.call(document.querySelectorAll('[data-nip-input]'));
    var sendButton = document.querySelector('[data-nip-send]');

    if (!nipInputs.length) {
        return;
    }

    nipInputs.forEach(function (input, index) {
        input.addEventListener('input', function () {
            var digit = input.value.replace(/\D/g, '').slice(-1);
            input.value = digit;
            state.nipConfirmed = false;
            renderNipConfirmed(state);

            if (digit && nipInputs[index + 1]) {
                nipInputs[index + 1].focus();
            }

            updateNipSendState(state);
            updateFinalState(state, false);
        });

        input.addEventListener('keydown', function (event) {
            if (event.key === 'Backspace' && !input.value && nipInputs[index - 1]) {
                event.preventDefault();
                nipInputs[index - 1].value = '';
                nipInputs[index - 1].focus();
                state.nipConfirmed = false;
                renderNipConfirmed(state);
                updateNipSendState(state);
                updateFinalState(state, false);
            }
        });

        input.addEventListener('paste', function (event) {
            var pastedText = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, nipInputs.length);

            if (!pastedText) {
                return;
            }

            event.preventDefault();
            nipInputs.forEach(function (item, itemIndex) {
                item.value = pastedText[itemIndex] || '';
            });
            nipInputs[Math.min(pastedText.length, nipInputs.length) - 1].focus();
            state.nipConfirmed = false;
            renderNipConfirmed(state);
            updateNipSendState(state);
            updateFinalState(state, false);
        });
    });

    if (sendButton) {
        sendButton.addEventListener('click', function () {
            var terms = document.getElementById('credit-terms');

            if (!terms || !terms.checked) {
                setSectionMessage('credit-terms', 'Debe aceptar los términos y condiciones.', false);
                return;
            }

            if (!getNipValue()) {
                setSectionMessage('nip', 'Debes capturar el NIP de verificación.', false);
                return;
            }

            state.nipConfirmed = true;
            renderNipConfirmed(state);
            setSectionMessage('nip', '', true);
            updateFinalState(state, false);
        });
    }

    var termsCheckbox = document.getElementById('credit-terms');
    if (termsCheckbox) {
        termsCheckbox.addEventListener('change', function () {
            state.nipConfirmed = false;
            renderNipConfirmed(state);
            updateNipSendState(state);
            updateFinalState(state, false);
        });
    }

    updateNipSendState(state);
}

function setupGlobalModalClose() {
    Array.prototype.slice.call(document.querySelectorAll('[data-close-modal]')).forEach(function (button) {
        button.addEventListener('click', function () {
            var modal = button.closest('[data-modal]');
            if (modal) {
                modal.hidden = true;
                updateModalHeaderState();
            }
        });
    });
}

function openCamera(state, mode, target) {
    var modal = getModal('camera');
    var video = document.querySelector('[data-camera-video]');
    var error = document.querySelector('[data-camera-error]');
    var captureButton = document.querySelector('[data-camera-capture]');
    var continueButton = document.querySelector('[data-camera-continue]');
    var retakeButton = document.querySelector('[data-camera-retake]');
    var preview = document.querySelector('[data-camera-preview]');

    state.camera.mode = mode;
    state.camera.target = target;
    state.camera.imageData = '';

    if (error) {
        error.hidden = true;
        error.textContent = '';
    }

    if (preview) {
        preview.hidden = true;
        preview.innerHTML = '';
    }

    if (video) {
        video.hidden = false;
    }

    setButtonDisabled(continueButton, true);
    if (retakeButton) {
        retakeButton.hidden = true;
    }
    if (captureButton) {
        captureButton.hidden = false;
    }

    openModal('camera');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showCameraError(state.camera.mode === 'selfie'
            ? 'No fue posible acceder a la cámara. Puedes usar la opción Subir selfie.'
            : 'No fue posible acceder a la cámara. Puedes usar la opción Subir archivo.');
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function (stream) {
            state.camera.stream = stream;
            if (video) {
                video.srcObject = stream;
            }
        })
        .catch(function () {
            showCameraError(state.camera.mode === 'selfie'
                ? 'No fue posible acceder a la cámara. Puedes usar la opción Subir selfie.'
                : 'No fue posible acceder a la cámara. Puedes usar la opción Subir archivo.');
        });

    if (!modal) {
        closeCamera(state);
    }
}

function captureCameraImage(state) {
    var video = document.querySelector('[data-camera-video]');
    var canvas = document.querySelector('[data-camera-canvas]');
    var preview = document.querySelector('[data-camera-preview]');
    var captureButton = document.querySelector('[data-camera-capture]');
    var retakeButton = document.querySelector('[data-camera-retake]');
    var continueButton = document.querySelector('[data-camera-continue]');

    if (!video || !canvas || !preview) {
        return;
    }

    var width = video.videoWidth || 640;
    var height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(video, 0, 0, width, height);
    state.camera.imageData = canvas.toDataURL('image/png');

    preview.innerHTML = '<img src="' + state.camera.imageData + '" alt="Vista previa de fotografía">';
    preview.hidden = false;
    video.hidden = true;
    if (captureButton) {
        captureButton.hidden = true;
    }
    if (retakeButton) {
        retakeButton.hidden = false;
    }
    setButtonDisabled(continueButton, false);
}

function resetCameraCapture(state) {
    var video = document.querySelector('[data-camera-video]');
    var preview = document.querySelector('[data-camera-preview]');
    var captureButton = document.querySelector('[data-camera-capture]');
    var retakeButton = document.querySelector('[data-camera-retake]');
    var continueButton = document.querySelector('[data-camera-continue]');

    state.camera.imageData = '';

    if (preview) {
        preview.hidden = true;
        preview.innerHTML = '';
    }
    if (video) {
        video.hidden = false;
    }
    if (captureButton) {
        captureButton.hidden = false;
    }
    if (retakeButton) {
        retakeButton.hidden = true;
    }

    setButtonDisabled(continueButton, true);
}

function closeCamera(state) {
    stopCamera(state);
    closeModal('camera');
}

function stopCamera(state) {
    if (state.camera.stream) {
        state.camera.stream.getTracks().forEach(function (track) {
            track.stop();
        });
    }

    state.camera.stream = null;
}

function showCameraError(message) {
    var error = document.querySelector('[data-camera-error]');
    var video = document.querySelector('[data-camera-video]');
    var captureButton = document.querySelector('[data-camera-capture]');

    if (video) {
        video.hidden = true;
    }
    if (captureButton) {
        captureButton.hidden = true;
    }
    if (error) {
        error.textContent = message;
        error.hidden = false;
    }
}

function validateForm2(state, showErrors) {
    var fields = [];
    var sections = [];

    addPracticeFields(fields);
    addIneFields(fields, sections, state);
    addInformationFields(fields);
    addRfcFields(fields);
    addAddressFields(fields, state);
    addDocumentSections(fields, sections, state);
    addCreditAndNip(fields, sections, state);

    if (showErrors) {
        renderFieldErrors(fields);
        renderSectionErrors(sections);
    }

    var required = fields.filter(function (field) {
        return field.required;
    });
    var correctRequired = required.filter(function (field) {
        return field.valid;
    });
    var filledRequired = required.filter(function (field) {
        return field.filled;
    });
    var optionalFilled = fields.filter(function (field) {
        return !field.required && field.filled;
    });
    var optionalEmpty = fields.filter(function (field) {
        return !field.required && !field.filled;
    });
    var optionalInvalid = optionalFilled.filter(function (field) {
        return !field.valid;
    });
    var reviewFields = required.filter(function (field) {
        return !field.valid;
    }).concat(optionalInvalid);
    var completedSections = sections.filter(function (section) {
        return section.valid;
    });
    var reviewSections = sections.filter(function (section) {
        return !section.valid;
    });
    var totalRequired = required.length;
    var filledPercent = totalRequired ? Math.round((filledRequired.length / totalRequired) * 100) : 0;
    var correctPercent = totalRequired ? Math.round((correctRequired.length / totalRequired) * 100) : 0;
    var email = getValue('form2-email');
    var emailReminder = '';

    if (isEmail(email) && email.toLowerCase() !== 'alta@conmigovales.com') {
        emailReminder = 'Recuerda utilizar el correo alta@conmigovales.com';
    }

    return {
        allValid: reviewFields.length === 0 && reviewSections.length === 0,
        fields: fields,
        sections: sections,
        totalRequired: totalRequired,
        filledCount: filledRequired.length,
        emptyCount: required.filter(function (field) { return !field.filled; }).length,
        correctCount: correctRequired.length,
        incorrectCount: totalRequired - correctRequired.length,
        filledPercent: filledPercent,
        correctPercent: correctPercent,
        performanceMessage: getPerformanceMessage(correctPercent),
        correctFields: fields.filter(function (field) { return field.valid && (field.required || field.filled); }),
        reviewFields: reviewFields,
        optionalFilled: optionalFilled,
        optionalEmpty: optionalEmpty,
        completedSections: completedSections,
        reviewSections: reviewSections,
        documentsLoaded: [
            state.ine.front ? 'INE frontal' : '',
            state.ine.back ? 'INE trasera' : '',
            state.proof ? 'Comprobante de domicilio' : ''
        ].filter(Boolean),
        selfieValidated: state.selfieValidated,
        nipConfirmed: state.nipConfirmed,
        emailReminder: emailReminder
    };
}

function addPracticeFields(fields) {
    addTextField(fields, 'form2-practice-collaborator', 'Nombre del colaborador en capacitación', true, 2, 50, 'Campo requerido. Ingresa el nombre del colaborador en capacitación.');
    addTextField(fields, 'form2-practice-branch', 'Sucursal de práctica', true, 2, 50, 'Campo requerido. Ingresa la sucursal de la práctica.');

    var practiceId = getValue('form2-practice-id');
    fields.push({
        id: 'form2-practice-id',
        label: 'ID de práctica',
        required: true,
        filled: !!practiceId,
        valid: /^\d{1,6}$/.test(practiceId),
        message: 'Campo requerido. Ingresa un ID numérico de máximo 6 dígitos.'
    });
}

function addIneFields(fields, sections, state) {
    fields.push(makeVirtualField('ine-front', 'INE frontal', true, !!state.ine.front, !!state.ine.front, 'Debes cargar el frente de la INE.'));
    fields.push(makeVirtualField('ine-back', 'INE trasera', true, !!state.ine.back, !!state.ine.back, 'Debes cargar el reverso de la INE.'));
    sections.push({
        key: 'ine',
        label: 'Validación INE',
        valid: state.ineConfirmed,
        message: 'Completa la validación INE con frente y reverso.'
    });
}

function addInformationFields(fields) {
    addUppercaseTextField(fields, 'birth-state', 'Entidad federativa de nacimiento', true, 2, 50, 'Debes capturar una entidad federativa de nacimiento válida.');
    addUppercaseTextField(fields, 'birth-country', 'País de nacimiento', true, 2, 50, 'Debes capturar un país de nacimiento válido.');

    [
        ['nationality', 'Nacionalidad', 'Debes seleccionar una nacionalidad.'],
        ['occupation', 'Ocupación', 'Debes seleccionar una ocupación.'],
        ['economic-activity', 'Actividad o giro económico SAT', 'Debes seleccionar una actividad.'],
        ['economic-sector', 'Sector económico', 'Debes seleccionar un sector económico.'],
        ['commerce-line', 'Giro - Comercio', 'Debes seleccionar un giro de comercio.'],
        ['same-business-address', 'Domicilio de actividad económica igual al solicitante', 'Debes seleccionar una opción.'],
        ['referred-by-distributor', 'Me refirió una distribuidora', 'Debes seleccionar una opción.']
    ].forEach(function (item) {
        addSelectField(fields, item[0], item[1], true, item[2]);
    });

    addPhoneField(fields, 'form2-phone', 'Celular', true, 'El número celular debe contener únicamente números y 10 dígitos.');
    addExpectedEmailField(fields, 'form2-email', 'Correo electrónico', true, 'alta@conmigovales.com');
    addAlphaOptionalField(fields, 'signature-series', 'No. Serie de firma electrónica', 'La serie de firma electrónica debe ser alfanumérica.');
    addPhoneField(fields, 'landline', 'Teléfono fijo', false, 'El teléfono fijo debe contener únicamente números y 10 dígitos.');
    addUppercaseTextField(fields, 'form2-branch', 'Sucursal', true, 1, 80, 'Recuerda capturar la información en MAYÚSCULAS y sin acentos.');
    addUppercaseTextField(fields, 'form2-collaborator', 'Colaborador', true, 1, 80, 'Recuerda capturar la información en MAYÚSCULAS y sin acentos.');

    var referred = getValue('referred-by-distributor').toLowerCase();
    var referrerRequired = referred === 'sí' || referred === 'si';
    addTextField(fields, 'referrer-curp', 'CURP de la DT que te refirió', referrerRequired, 1, 80, 'Debes capturar la CURP de la DT que te refirió.');
}

function addRfcFields(fields) {
    var confirmation = getValue('rfc-confirmation').toLowerCase();
    var homoclaveRequired = confirmation.indexOf('sí') === 0 || confirmation.indexOf('si') === 0;

    addUppercaseTextField(fields, 'rfc', 'RFC', true, 1, 10, 'Recuerda que este campo solo se agrega RFC sin homoclave.');
    addUppercaseTextField(
        fields,
        'rfc-homoclave',
        'Homoclave de RFC',
        homoclaveRequired,
        1,
        3,
        homoclaveRequired
            ? 'Si seleccionas que sí cuentas con homoclave, debes capturarla.'
            : 'Recuerda que en este campo se agrega solo homoclave del RFC.'
    );
    addSelectField(fields, 'rfc-confirmation', 'Confirmación homoclave', true, 'Recuerda que en caso de no haber llenado la homoclave, deberás seleccionar que no cuentas con homoclave.');
    addUppercaseTextField(fields, 'prospect-rfc', 'RFC del prospecto', true, 1, 13, 'RFC + homoclave en caso de conocerla.');
}

function addAddressFields(fields, state) {
    [
        ['street', 'Calle', 'Debes capturar la calle.'],
        ['external-number', 'No. exterior', 'Debes capturar el número exterior.'],
        ['between-street', 'Entre calle', 'Debes capturar la entre calle.'],
        ['and-street', 'Y calle', 'Debes capturar la y calle.'],
        ['reference', 'Referencia', 'Debes capturar la referencia.']
    ].forEach(function (item) {
        addUppercaseTextField(fields, item[0], item[1], true, 1, 120, item[2]);
    });

    addUppercaseTextField(fields, 'internal-number', 'No. interior', false, 1, 80, '');

    [
        ['municipality', 'Alcaldía o municipio', 'Debes capturar la alcaldía o municipio.'],
        ['city', 'Ciudad', 'Debes capturar la ciudad.'],
        ['state', 'Estado', 'Debes capturar el estado.'],
        ['country', 'País', 'Debes capturar el país.']
    ].forEach(function (item) {
        if (state.addressManualMode) {
            addUppercaseTextField(fields, item[0], item[1], true, 1, 120, item[2]);
        } else {
            addTextField(fields, item[0], item[1], true, 1, 120, item[2]);
        }
    });

    var cp = getValue('postal-code');
    var neighborhood = getNeighborhoodValue();
    fields.push({
        id: 'postal-code',
        label: 'Código Postal',
        required: true,
        filled: !!cp,
        valid: /^\d{5}$/.test(cp),
        message: 'El código postal debe contener únicamente 5 números.'
    });
    fields.push({
        id: 'neighborhood',
        label: 'Colonia',
        required: true,
        filled: !!neighborhood,
        valid: !!neighborhood && (!state.addressManualMode || isUppercaseText(neighborhood)),
        progressValid: !!neighborhood,
        message: neighborhood && state.addressManualMode
            ? 'Captura este campo en MAYÚSCULAS para que sea correcto.'
            : 'Debes capturar o seleccionar una colonia.'
    });
}

function addDocumentSections(fields, sections, state) {
    fields.push(makeVirtualField('proof-document', 'Comprobante de domicilio', true, !!state.proof, !!state.proof, 'Debes cargar un comprobante de domicilio.'));
    fields.push(makeVirtualField('selfie-validation', 'Validación biométrica selfie', true, state.selfieValidated, state.selfieValidated, 'Debes capturar o subir una selfie.'));
    sections.push({
        key: 'proof',
        label: 'Comprobante de domicilio',
        valid: !!state.proof,
        message: 'Debes cargar un comprobante de domicilio.'
    });
    sections.push({
        key: 'selfie',
        label: 'Validación biométrica selfie',
        valid: state.selfieValidated,
        message: 'Debes validar la selfie.'
    });
}

function addCreditAndNip(fields, sections, state) {
    var terms = document.getElementById('credit-terms');
    fields.push({
        id: 'credit-terms',
        label: 'Aceptar términos y condiciones',
        required: true,
        filled: !!(terms && terms.checked),
        valid: !!(terms && terms.checked),
        message: 'Debe aceptar los términos y condiciones.'
    });
    fields.push(makeVirtualField('nip-confirmed', 'NIP confirmado', true, state.nipConfirmed, state.nipConfirmed, 'Debes confirmar el NIP de verificación.'));
    sections.push({
        key: 'credit-terms',
        label: 'Historial crediticio',
        valid: !!(terms && terms.checked),
        message: 'Debe aceptar los términos y condiciones.'
    });
    sections.push({
        key: 'nip',
        label: 'NIP',
        valid: state.nipConfirmed,
        message: 'Debes confirmar el NIP de verificación.'
    });
}

function addTextField(fields, id, label, required, min, max, message) {
    var value = getValue(id);
    var filled = !!value;
    var valid = required ? filled : true;

    if (filled && (value.length < min || value.length > max)) {
        valid = false;
    }

    fields.push({
        id: id,
        label: label,
        required: required,
        filled: filled,
        valid: valid,
        message: message
    });
}

function addUppercaseTextField(fields, id, label, required, min, max, message) {
    var value = getValue(id);
    var filled = !!value;
    var valid = required ? filled : true;
    var progressValid = valid;
    var fieldMessage = message;

    if (filled && (value.length < min || value.length > max)) {
        valid = false;
        progressValid = false;
    } else if (filled && !isUppercaseText(value)) {
        valid = false;
        fieldMessage = 'Captura este campo en MAYÚSCULAS para que sea correcto.';
    }

    fields.push({
        id: id,
        label: label,
        required: required,
        filled: filled,
        valid: valid,
        progressValid: progressValid,
        message: fieldMessage
    });
}

function addAlphaOptionalField(fields, id, label, message) {
    var value = getValue(id);
    var filled = !!value;

    fields.push({
        id: id,
        label: label,
        required: false,
        filled: filled,
        valid: !filled || /^[A-Za-z0-9]+$/.test(value),
        message: message
    });
}

function addPhoneField(fields, id, label, required, message) {
    var value = getValue(id);
    var filled = !!value;
    fields.push({
        id: id,
        label: label,
        required: required,
        filled: filled,
        valid: required ? /^\d{10}$/.test(value) : (!filled || /^\d{10}$/.test(value)),
        message: message
    });
}

function addEmailField(fields, id, label, required) {
    var value = getValue(id);
    var filled = !!value;
    fields.push({
        id: id,
        label: label,
        required: required,
        filled: filled,
        valid: required ? isEmail(value) : (!filled || isEmail(value)),
        message: filled ? 'Debes ingresar un correo electrónico válido.' : 'Debes ingresar un correo electrónico válido.'
    });
}

function addExpectedEmailField(fields, id, label, required, expectedEmail) {
    var value = getValue(id);
    var filled = !!value;
    var hasValidFormat = isEmail(value);
    var matchesExpected = value.toLowerCase() === expectedEmail.toLowerCase();
    var valid = required ? (hasValidFormat && matchesExpected) : (!filled || (hasValidFormat && matchesExpected));

    fields.push({
        id: id,
        label: label,
        required: required,
        filled: filled,
        valid: valid,
        message: 'Debes usar un correo electrónico con formato válido y el correo aprobado: ' + expectedEmail
    });
}

function addSelectField(fields, id, label, required, message) {
    var value = getValue(id);
    fields.push({
        id: id,
        label: label,
        required: required,
        filled: !!value,
        valid: required ? !!value : true,
        message: message
    });
}

function makeVirtualField(id, label, required, filled, valid, message) {
    return {
        id: id,
        label: label,
        required: required,
        filled: filled,
        valid: valid,
        message: message,
        virtual: true
    };
}

function renderFieldErrors(fields) {
    fields.forEach(function (field) {
        if (field.virtual) {
            return;
        }

        var input = field.id === 'neighborhood' ? getNeighborhoodControl() : document.getElementById(field.id);
        setFieldError(input, field.valid ? '' : field.message, true);
    });
}

function renderSectionErrors(sections) {
    sections.forEach(function (section) {
        setSectionMessage(section.key, section.valid ? '' : section.message, false);
    });
}

function updateFinalState(state, showErrors) {
    var metrics = validateForm2(state, showErrors && state.attemptedFinalize);
    var completion = getCompletionState(state, metrics);
    var finalizeButton = document.querySelector('[data-form2-finalize]');
    var statusTitle = document.querySelector('[data-form2-status-title]');

    metrics.allValid = completion.allComplete;
    state.lastMetrics = metrics;
    setButtonDisabled(finalizeButton, !completion.allComplete);

    if (statusTitle) {
        statusTitle.textContent = completion.allComplete ? 'Información actualizada' : 'Completa la información requerida para finalizar';
    }
}

function getCompletionState(state, metrics) {
    var requiredFields = metrics.fields.filter(function (field) {
        return field.required;
    });
    var optionalInvalid = metrics.optionalFilled.filter(function (field) {
        return !isFieldReadyForCompletion(field);
    });
    var emailCanContinue = !!getValue('form2-email');
    var sectionByKey = {};

    metrics.sections.forEach(function (section) {
        sectionByKey[section.key] = section.valid;
    });

    var completion = {
        practiceComplete: areFieldsValid(metrics.fields, ['form2-practice-collaborator', 'form2-practice-branch', 'form2-practice-id']),
        ineComplete: !!(state.ine.front && state.ine.back),
        additionalInfoComplete: areFieldsValid(metrics.fields, [
            'birth-state',
            'birth-country',
            'nationality',
            'occupation',
            'economic-activity',
            'economic-sector',
            'commerce-line',
            'same-business-address',
            'form2-phone',
            'referred-by-distributor',
            'form2-branch',
            'form2-collaborator'
        ]) && emailCanContinue && !hasInvalidRequiredLabel(metrics.reviewFields, 'CURP de la DT'),
        rfcComplete: areFieldsValid(metrics.fields, ['rfc', 'rfc-confirmation', 'prospect-rfc']) && !hasInvalidRequiredLabel(metrics.reviewFields, 'Homoclave requerida'),
        addressComplete: areFieldsValid(metrics.fields, [
            'street',
            'external-number',
            'between-street',
            'and-street',
            'reference',
            'postal-code',
            'neighborhood',
            'municipality',
            'city',
            'state',
            'country'
        ]),
        proofComplete: !!state.proof,
        selfieValidated: !!state.selfieValidated,
        creditAccepted: !!(document.getElementById('credit-terms') && document.getElementById('credit-terms').checked),
        nipConfirmed: !!state.nipConfirmed,
        optionalValid: optionalInvalid.length === 0,
        requiredValid: requiredFields.every(function (field) {
            return isFieldReadyForCompletion(field) || (field.id === 'form2-email' && emailCanContinue);
        })
    };

    completion.allComplete = completion.practiceComplete &&
        completion.ineComplete &&
        completion.additionalInfoComplete &&
        completion.rfcComplete &&
        completion.addressComplete &&
        completion.proofComplete &&
        completion.selfieValidated &&
        completion.creditAccepted &&
        completion.nipConfirmed &&
        completion.optionalValid &&
        completion.requiredValid;

    return completion;
}

function areFieldsValid(fields, ids) {
    return ids.every(function (id) {
        return fields.some(function (field) {
            return field.id === id && isFieldReadyForCompletion(field);
        });
    });
}

function isFieldReadyForCompletion(field) {
    return typeof field.progressValid === 'boolean' ? field.progressValid : field.valid;
}

function hasInvalidRequiredLabel(fields, labelFragment) {
    return fields.some(function (field) {
        return field.required && field.label.indexOf(labelFragment) !== -1;
    });
}

function renderFinalFeedback(metrics) {
    var panel = document.getElementById('form2-practice-result');
    var collaboratorName = getValue('form2-practice-collaborator') || 'colaborador en capacitación';
    var correctItems = listItems(metrics.correctFields, 'Aún no hay campos correctos.', false);
    var reviewItems = listItems(metrics.reviewFields, 'No hay campos por revisar.', true);
    var completedSections = listLabels(metrics.completedSections, 'Sin secciones completadas.');
    var reviewSections = listLabels(metrics.reviewSections, 'Sin secciones por revisar.');
    var documents = metrics.documentsLoaded.length ? metrics.documentsLoaded.join(', ') : 'Sin documentos cargados.';
    var optionalFilled = metrics.optionalFilled.length ? metrics.optionalFilled.map(function (field) { return field.label; }).join(', ') : 'Ninguno';
    var optionalEmpty = metrics.optionalEmpty.length ? metrics.optionalEmpty.map(function (field) { return field.label; }).join(', ') : 'Ninguno';
    var reminder = metrics.emailReminder ? '<p class="result-recommendation">' + escapeHtml(metrics.emailReminder) + '</p>' : '';

    if (!panel) {
        return;
    }

    panel.hidden = true;
    panel.innerHTML = [
        '<div class="result-header">',
        '<h2>Resultado de práctica</h2>',
        '<p>Gracias, ' + escapeHtml(collaboratorName) + '.</p>',
        '<p>Sucursal: ' + escapeHtml(getValue('form2-practice-branch') || 'Sin capturar') + ' · ID: ' + escapeHtml(getValue('form2-practice-id') || 'Sin capturar') + '</p>',
        '<p>' + escapeHtml(metrics.performanceMessage) + '</p>',
        '</div>',
        '<div class="result-grid">',
        '<div><strong>' + metrics.totalRequired + '</strong><span>Total de campos requeridos</span></div>',
        '<div><strong>' + metrics.filledCount + '</strong><span>Campos llenados</span></div>',
        '<div><strong>' + metrics.emptyCount + '</strong><span>Campos vacíos</span></div>',
        '<div><strong>' + metrics.correctCount + '</strong><span>Campos correctos</span></div>',
        '<div><strong>' + metrics.incorrectCount + '</strong><span>Campos incorrectos</span></div>',
        '<div><strong>' + metrics.filledPercent + '%</strong><span>Porcentaje de llenado</span></div>',
        '<div><strong>' + metrics.correctPercent + '%</strong><span>Porcentaje correcto</span></div>',
        '</div>',
        '<div class="result-lists">',
        '<div><h3>Campos correctos</h3><ul>' + correctItems + '</ul></div>',
        '<div><h3>Campos por revisar</h3><ul>' + reviewItems + '</ul></div>',
        '<div><h3>Secciones completadas</h3><ul>' + completedSections + '</ul></div>',
        '<div><h3>Secciones por revisar</h3><ul>' + reviewSections + '</ul></div>',
        '</div>',
        '<p class="result-recommendation">Documentos cargados: ' + escapeHtml(documents) + '.</p>',
        '<p class="result-recommendation">Opcionales llenados: ' + escapeHtml(optionalFilled) + '. Opcionales vacíos: ' + escapeHtml(optionalEmpty) + '.</p>',
        '<p class="result-recommendation">Selfie validada: ' + (metrics.selfieValidated ? 'Sí' : 'No') + ' · NIP confirmado: ' + (metrics.nipConfirmed ? 'Sí' : 'No') + '.</p>',
        '<p class="result-recommendation">Recuerda que la dirección registrada del prospecto debe coincidir con la dirección que se encuentra en el comprobante de domicilio.</p>',
        reminder,
        '<button type="button" class="btn-primary form2-small-button" data-form2-print-result>Imprimir resultado</button>'
    ].join('');

    var printButton = panel.querySelector('[data-form2-print-result]');
    if (printButton) {
        printButton.addEventListener('click', function () {
            document.body.classList.add('is-printing-feedback');
            window.print();
        });
    }
}

function showSuccessScreen() {
    var success = document.querySelector('[data-form2-success]');

    document.body.classList.add('is-final-success');
    if (success) {
        success.hidden = false;
        success.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function renderIneSide(state, side) {
    var preview = document.querySelector('[data-ine-preview="' + side + '"]');
    var uploadButton = document.querySelector('[data-ine-upload="' + side + '"]');
    var stored = state.ine[side];

    if (!preview || !stored) {
        return;
    }

    renderStoredFile(preview, stored);
    preview.classList.remove('ine-empty-preview');
    if (uploadButton) {
        uploadButton.textContent = 'Actualizar archivos';
    }
}

function renderIneMainState(state) {
    var intro = document.querySelector('.ine-intro');

    if (!intro) {
        return;
    }

    intro.classList.add('is-complete');
    intro.innerHTML = [
        '<img class="ine-complete-check" src="../assets/images/img-check.86f2857.png" alt="" aria-hidden="true">',
        '<h4>Identificación oficial</h4>',
        '<p>Tus archivos han sido cargados con éxito.</p>',
        '<button type="button" class="btn-outline" data-open-ine>Actualizar archivos</button>',
        '<p class="form2-section-note" data-section-error="ine" hidden></p>'
    ].join('');

    var openButton = intro.querySelector('[data-open-ine]');
    if (openButton) {
        openButton.addEventListener('click', function () {
            resetIneForUpdate(state);
            openModal('ine');
            updateFinalState(state, false);
        });
    }
}

function resetIneForUpdate(state) {
    if (state) {
        state.ine.front = null;
        state.ine.back = null;
        state.ineConfirmed = false;
    }

    resetIneSide('front');
    resetIneSide('back');
    updateIneModalState(state);
    renderIneInitialState();
}

function resetIneSide(side) {
    var preview = document.querySelector('[data-ine-preview="' + side + '"]');
    var uploadButton = document.querySelector('[data-ine-upload="' + side + '"]');
    var label = side === 'front' ? 'Frente' : 'Reverso';

    if (preview) {
        preview.classList.add('ine-empty-preview');
        preview.innerHTML = [
            '<img src="../assets/images/uploadfile.95ff695.png" alt="" aria-hidden="true">',
            '<strong>Arrastra aquí tu archivo ' + label + '</strong>',
            '<span>Sube tu archivo en formato JPEG o PNG</span>'
        ].join('');
    }

    if (uploadButton) {
        uploadButton.textContent = 'Subir archivo';
    }
}

function renderIneInitialState() {
    var intro = document.querySelector('.ine-intro');

    if (!intro) {
        return;
    }

    intro.classList.remove('is-complete');
    intro.innerHTML = [
        '<img class="ine-visual" src="../assets/images/INE.jpg" alt="Identificación oficial">',
        '<h4>Identificación oficial</h4>',
        '<p>Para seguir con tu solicitud, es necesario cargar tu identificación oficial.</p>',
        '<p>El documento será verificado automáticamente.</p>',
        '<button type="button" class="btn-outline" data-open-ine>Subir archivo</button>',
        '<p class="form2-section-note" data-section-error="ine" hidden></p>'
    ].join('');

    var openButton = intro.querySelector('[data-open-ine]');
    if (openButton) {
        openButton.addEventListener('click', function () {
            openModal('ine');
        });
    }
}

function updateIneModalState(state) {
    var isComplete = !!(state.ine.front && state.ine.back);
    var continueButton = document.querySelector('[data-ine-continue]');
    var completeIndicator = document.querySelector('[data-ine-complete]');

    state.ineConfirmed = isComplete;
    setButtonDisabled(continueButton, !isComplete);
    if (completeIndicator) {
        completeIndicator.hidden = true;
    }
}

function renderProofState(state) {
    var status = document.querySelector('[data-proof-status]');
    var uploadButton = document.querySelector('[data-proof-upload]');
    var viewButton = document.querySelector('[data-proof-view]');

    if (status) {
        status.textContent = 'Documento cargado';
        status.classList.remove('is-pending');
        status.classList.add('is-loaded');
    }
    if (uploadButton) {
        uploadButton.textContent = 'Volver a subir';
    }
    if (viewButton) {
        viewButton.disabled = false;
    }

    setSectionMessage('proof', '', true);
}

function renderSelfieState(view) {
    var initial = document.querySelector('[data-selfie-initial]');
    var processing = document.querySelector('[data-selfie-processing]');
    var success = document.querySelector('[data-selfie-success]');

    if (initial) {
        initial.hidden = view !== 'initial';
    }
    if (processing) {
        processing.hidden = view !== 'processing';
    }
    if (success) {
        success.hidden = view !== 'success';
    }
}

function startSelfieProcessing(state) {
    state.selfieValidated = false;
    renderSelfieState('processing');
    setSectionMessage('selfie', '', true);

    window.setTimeout(function () {
        state.selfieValidated = true;
        renderSelfieState('success');
        setSectionMessage('selfie', '', true);
        updateFinalState(state, false);
    }, 900);
}

function renderNipConfirmed(state) {
    var confirmed = document.querySelector('[data-nip-confirmed]');
    var identityConfirmed = document.querySelector('[data-identity-confirmed]');
    var identityState = document.querySelector('[data-identity-auth-state]');
    var nipSection = document.querySelector('[data-nip-section]');
    var inputState = document.querySelector('[data-nip-input-state]');
    var title = document.querySelector('.nip-card h3');
    var inputs = document.querySelector('.nip-inputs');
    var resend = document.querySelector('.nip-resend');
    var actions = document.querySelector('.nip-actions');
    var error = document.querySelector('[data-section-error="nip"]');

    if (confirmed) {
        confirmed.hidden = !state.nipConfirmed;
    }
    if (identityConfirmed) {
        identityConfirmed.hidden = !state.nipConfirmed;
    }
    if (identityState) {
        identityState.hidden = state.nipConfirmed;
    }
    if (nipSection) {
        nipSection.hidden = state.nipConfirmed;
    }
    if (inputState) {
        inputState.hidden = state.nipConfirmed;
    }
    if (title) {
        title.hidden = state.nipConfirmed;
    }
    if (inputs) {
        inputs.hidden = state.nipConfirmed;
    }
    if (resend) {
        resend.hidden = state.nipConfirmed;
    }
    if (actions) {
        actions.hidden = state.nipConfirmed;
    }
    if (error) {
        error.hidden = state.nipConfirmed || !error.textContent;
    }
}

function updateNipSendState(state) {
    var terms = document.getElementById('credit-terms');
    var sendButton = document.querySelector('[data-nip-send]');
    var enabled = !!(terms && terms.checked && getNipValue());

    setButtonDisabled(sendButton, !enabled);
}

function renderPreviewModal(stored) {
    var content = document.querySelector('[data-preview-content]');

    if (content) {
        renderStoredFile(content, stored);
    }

    openModal('preview');
}

function renderStoredFile(container, stored) {
    if (!stored) {
        container.textContent = 'Documento pendiente';
        return;
    }

    if (stored.dataUrl && stored.type.indexOf('image/') === 0) {
        container.innerHTML = '<img src="' + stored.dataUrl + '" alt="' + escapeHtml(stored.label) + '">';
        return;
    }

    container.innerHTML = '<strong>' + escapeHtml(stored.name) + '</strong><span>Archivo cargado localmente</span>';
}

function setDocumentState(bucket, key, file, label) {
    if (file.dataUrl) {
        bucket[key] = {
            name: file.name,
            type: file.type,
            dataUrl: file.dataUrl,
            label: label
        };
        return;
    }

    bucket[key] = createStoredFile(file, label);
}

function createStoredFile(file, label) {
    var stored = {
        name: file.name,
        type: file.type || '',
        dataUrl: '',
        label: label
    };

    if (stored.type.indexOf('image/') === 0) {
        var reader = new FileReader();
        reader.addEventListener('load', function () {
            stored.dataUrl = reader.result;
            rerenderLoadedPreviews(stored);
        });
        reader.readAsDataURL(file);
    }

    return stored;
}

function rerenderLoadedPreviews(stored) {
    Array.prototype.slice.call(document.querySelectorAll('.file-preview')).forEach(function (preview) {
        if (preview.textContent.indexOf(stored.name) !== -1) {
            renderStoredFile(preview, stored);
        }
    });
}

function isAllowedDocument(file) {
    return /(\.jpg|\.jpeg|\.png|\.pdf)$/i.test(file.name) || ['image/jpeg', 'image/png', 'application/pdf'].indexOf(file.type) !== -1;
}

function isAllowedSelfie(file) {
    return /(\.jpg|\.jpeg|\.png)$/i.test(file.name) || ['image/jpeg', 'image/png'].indexOf(file.type) !== -1;
}

function getNipValue() {
    var inputs = Array.prototype.slice.call(document.querySelectorAll('[data-nip-input]'));
    var value = inputs.map(function (input) {
        return input.value;
    }).join('');

    return /^\d{4}$/.test(value) ? value : '';
}

function getModal(name) {
    return document.querySelector('[data-modal="' + name + '"]');
}

function openModal(name) {
    var modal = getModal(name);

    if (modal) {
        modal.hidden = false;
        document.body.classList.add('has-open-modal');
    }
}

function closeModal(name) {
    var modal = getModal(name);

    if (modal) {
        modal.hidden = true;
        updateModalHeaderState();
    }
}

function updateModalHeaderState() {
    var hasOpenModal = Array.prototype.slice.call(document.querySelectorAll('[data-modal]')).some(function (modal) {
        return !modal.hidden;
    });

    document.body.classList.toggle('has-open-modal', hasOpenModal);
}

function showModalMessage(name, message) {
    var messageNode = document.querySelector('[data-modal-message="' + name + '"]');

    if (!messageNode) {
        return;
    }

    messageNode.textContent = message;
    messageNode.hidden = !message;
}

function setSectionMessage(key, message, success) {
    var node = document.querySelector('[data-section-error="' + key + '"]');

    if (!node) {
        return;
    }

    node.textContent = message;
    node.hidden = !message;
    node.classList.toggle('is-success', !!success && !!message);
}

function setFieldError(input, message, show) {
    if (!input) {
        return;
    }

    var errorId = input.id + '-error';
    var error = document.getElementById(errorId);

    if (!error) {
        error = document.createElement('small');
        error.id = errorId;
        error.className = 'field-error';
        input.insertAdjacentElement('afterend', error);
    }

    if (!message || !show) {
        input.classList.remove('field-invalid');
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
        error.hidden = true;
        error.textContent = '';
        return;
    }

    input.classList.add('field-invalid');
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', errorId);
    error.hidden = false;
    error.textContent = message;
}

function setButtonDisabled(button, disabled) {
    if (!button) {
        return;
    }

    button.disabled = disabled;
    button.classList.toggle('is-disabled', disabled);
}

function getValue(id) {
    var input = document.getElementById(id);
    return input ? input.value.trim() : '';
}

function isUppercaseText(value) {
    var text = String(value || '').trim();
    return text === text.toUpperCase();
}

function getNeighborhoodValue() {
    var control = getNeighborhoodControl();
    return control ? control.value.trim() : '';
}

function getNeighborhoodControl() {
    var manual = document.getElementById('neighborhood-manual');
    var select = document.getElementById('neighborhood');

    if (manual && !manual.hidden) {
        return manual;
    }

    return select;
}

function setValue(id, value) {
    var input = document.getElementById(id);

    if (input) {
        input.value = value;
    }
}

function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
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

    return 'Se recomienda repetir la práctica.';
}

function listItems(fields, emptyText, includeMessage) {
    if (!fields.length) {
        return '<li>' + escapeHtml(emptyText) + '</li>';
    }

    return fields.map(function (field) {
        var detail = includeMessage && field.message ? ': ' + field.message : '';
        return '<li>' + escapeHtml(field.label + detail) + '</li>';
    }).join('');
}

function listLabels(items, emptyText) {
    if (!items.length) {
        return '<li>' + escapeHtml(emptyText) + '</li>';
    }

    return items.map(function (item) {
        return '<li>' + escapeHtml(item.label) + '</li>';
    }).join('');
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function focusFirstInvalid() {
    var invalid = document.querySelector('.field-invalid');

    if (invalid) {
        invalid.focus();
        invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
