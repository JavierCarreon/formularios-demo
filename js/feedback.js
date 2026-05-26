window.PracticeFeedback = (function () {
    function getPerformance(percent) {
        if (percent >= 90) {
            return 'Excelente.';
        }

        if (percent >= 75) {
            return 'Buen avance. Revisa los campos marcados antes de continuar.';
        }

        if (percent >= 60) {
            return 'Requiere reforzamiento. Revisa los campos marcados y vuelve a intentarlo.';
        }

        return 'Se recomienda repetir la práctica. Completa los campos marcados antes de continuar.';
    }

    function calculate(fieldResults) {
        var requiredFields = fieldResults.filter(function (field) {
            return field.required;
        });
        var correctRequired = requiredFields.filter(function (field) {
            return field.valid;
        });
        var filledRequired = requiredFields.filter(function (field) {
            return field.filled;
        });
        var optionalIncorrect = fieldResults.filter(function (field) {
            return !field.required && field.filled && !field.valid;
        });
        var reviewFields = requiredFields.filter(function (field) {
            return !field.valid;
        }).concat(optionalIncorrect);
        var totalRequired = requiredFields.length;
        var filledPercent = totalRequired ? Math.round((filledRequired.length / totalRequired) * 100) : 0;
        var correctPercent = totalRequired ? Math.round((correctRequired.length / totalRequired) * 100) : 0;

        return {
            totalRequired: totalRequired,
            filledCount: filledRequired.length,
            emptyCount: requiredFields.filter(function (field) { return !field.filled; }).length,
            correctCount: correctRequired.length,
            incorrectCount: totalRequired - correctRequired.length,
            filledPercent: filledPercent,
            correctPercent: correctPercent,
            performanceMessage: getPerformance(correctPercent),
            correctFields: fieldResults.filter(function (field) {
                return field.valid && (field.required || field.filled);
            }),
            reviewFields: reviewFields
        };
    }

    function listItems(fields, emptyText) {
        if (!fields.length) {
            return '<li>' + emptyText + '</li>';
        }

        return fields.map(function (field) {
            var detail = field.message ? ': ' + escapeHtml(field.message) : '';
            return '<li>' + escapeHtml(field.label) + detail + '</li>';
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

    function render(container, collaboratorName, metrics) {
        if (!container) {
            return;
        }

        container.hidden = false;
        container.innerHTML = [
            '<div class="result-header">',
            '<h2>Resultado de práctica</h2>',
            '<p>Gracias, ' + escapeHtml(collaboratorName || 'colaborador en capacitación') + '.</p>',
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
            '<div>',
            '<h3>Campos correctos</h3>',
            '<ul>' + listItems(metrics.correctFields, 'Aún no hay campos correctos.') + '</ul>',
            '</div>',
            '<div>',
            '<h3>Campos por revisar</h3>',
            '<ul>' + listItems(metrics.reviewFields, 'No hay campos por revisar.') + '</ul>',
            '</div>',
            '</div>',
            '<p class="result-recommendation">Recomendación: revisa los campos marcados y confirma que coincidan con las reglas de la práctica.</p>',
            '<button type="button" class="btn-print" id="print-result-btn">Imprimir resultado</button>'
        ].join('');

        var printButton = container.querySelector('#print-result-btn');
        if (printButton) {
            printButton.addEventListener('click', function () {
                window.print();
            });
        }
    }

    return {
        calculate: calculate,
        render: render
    };
})();
