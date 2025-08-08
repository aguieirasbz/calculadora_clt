document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('calc-form');
    if (!form) return; // Só executa na página da ferramenta

    form.addEventListener('submit', function(event) {
        event.preventDefault();
        
        // --- Coleta de Dados ---
        const ultimoSalario = parseFloat(document.getElementById('ultimoSalario').value);
        const dataAdmissao = new Date(document.getElementById('dataAdmissao').value + 'T00:00:00');
        const dataDemissao = new Date(document.getElementById('dataDemissao').value + 'T00:00:00');
        const motivo = document.getElementById('motivo').value;
        const avisoPrevioTipo = document.getElementById('avisoPrevio').value;
        const feriasVencidas = document.getElementById('feriasVencidas').value === 'sim';

        // --- Validação ---
        if (isNaN(ultimoSalario) || ultimoSalario <= 0 || isNaN(dataAdmissao) || isNaN(dataDemissao)) {
            alert('Por favor, preencha todos os campos com valores válidos.');
            return;
        }
        if (dataDemissao < dataAdmissao) {
            alert('A data de demissão não pode ser anterior à data de admissão.');
            return;
        }

        // --- Lógica de Cálculo ---
        const results = calcularRescisao(ultimoSalario, dataAdmissao, dataDemissao, motivo, avisoPrevioTipo, feriasVencidas);

        // --- Exibição dos Resultados ---
        exibirResultados(results);
    });

    function calcularRescisao(salario, admissao, demissao, motivo, avisoTipo, temFeriasVencidas) {
        let verbas = {
            saldoSalario: 0,
            avisoPrevio: 0,
            decimoTerceiroProporcional: 0,
            feriasVencidas: 0,
            tercoFeriasVencidas: 0,
            feriasProporcionais: 0,
            tercoFeriasProporcionais: 0,
            multaFgts: 0,
            total: 0,
            observacoes: []
        };
        
        if (motivo === 'com_justa_causa') {
            verbas.observacoes.push('Demissão por justa causa: a maioria das verbas rescisórias não é devida.');
            const diasTrabalhadosMes = demissao.getDate();
            verbas.saldoSalario = (salario / 30) * diasTrabalhadosMes;
            if(temFeriasVencidas){
                verbas.feriasVencidas = salario;
                verbas.tercoFeriasVencidas = salario / 3;
            }
            verbas.total = verbas.saldoSalario + verbas.feriasVencidas + verbas.tercoFeriasVencidas;
            return verbas;
        }

        // 1. Saldo de Salário
        const diasTrabalhadosMes = demissao.getDate();
        verbas.saldoSalario = (salario / 30) * diasTrabalhadosMes;

        // 2. Aviso Prévio
        if (motivo === 'sem_justa_causa' && avisoTipo === 'indenizado') {
            verbas.avisoPrevio = salario;
        } else if (motivo === 'pedido_demissao' && avisoTipo === 'trabalhado') {
            verbas.observacoes.push("Em pedido de demissão com aviso trabalhado, o valor é pago no salário e não na rescisão.");
        } else if (motivo === 'pedido_demissao' && avisoTipo === 'indenizado') {
             verbas.observacoes.push("Em pedido de demissão, o aviso indenizado pode ser descontado do trabalhador.");
        }


        // 3. Meses trabalhados para proporcionais
        const mesesTrabalhadosAno = (demissao.getMonth() + 1);
        const diasNoMesDemissao = demissao.getDate();
        const mesesConsideradosParaDecimoTerceiro = (diasNoMesDemissao >= 15) ? mesesTrabalhadosAno : mesesTrabalhadosAno -1;
        
        let diffTime = Math.abs(demissao - admissao);
        let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        let mesesTrabalhadosTotal = Math.floor(diffDays / 30);
        let mesesParaFeriasProporcionais = mesesTrabalhadosTotal % 12;
        if(diasTrabalhadosMes >= 15) {
             mesesParaFeriasProporcionais += 1;
        }


        // 4. 13º Salário Proporcional
        verbas.decimoTerceiroProporcional = (salario / 12) * mesesConsideradosParaDecimoTerceiro;

        // 5. Férias Vencidas + 1/3
        if (temFeriasVencidas) {
            verbas.feriasVencidas = salario;
            verbas.tercoFeriasVencidas = salario / 3;
        }

        // 6. Férias Proporcionais + 1/3
        verbas.feriasProporcionais = (salario / 12) * mesesParaFeriasProporcionais;
        verbas.tercoFeriasProporcionais = verbas.feriasProporcionais / 3;
        
        if (motivo === 'pedido_demissao') {
            verbas.multaFgts = 0; // Não tem direito
            verbas.observacoes.push("Pedido de demissão não dá direito à multa de 40% do FGTS nem ao saque do FGTS.");
        }

        // Cálculo do Total
        let totalBruto = Object.values(verbas).reduce((acc, value) => {
            return typeof value === 'number' ? acc + value : acc;
        }, 0);
        verbas.total = totalBruto;
        
        // Multa FGTS (calculada sobre verbas e depósitos, simplificado aqui)
         if (motivo === 'sem_justa_causa') {
            let baseFgts = (verbas.saldoSalario + verbas.avisoPrevio + verbas.decimoTerceiroProporcional);
            verbas.multaFgts = baseFgts * 0.40; // Simplificação. O real é sobre todo o saldo.
            verbas.observacoes.push("A multa de 40% do FGTS é calculada sobre o saldo total depositado na conta do FGTS, o valor aqui é uma estimativa simplificada.");
            verbas.total += verbas.multaFgts;
        }


        return verbas;
    }

    function exibirResultados(results) {
        const outputDiv = document.getElementById('results-output');
        const resultsSection = document.getElementById('results-section');
        
        const formatBRL = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        let html = '';
        if (results.saldoSalario > 0) html += `<p><span>Saldo de Salário:</span> <span>${formatBRL(results.saldoSalario)}</span></p>`;
        if (results.avisoPrevio > 0) html += `<p><span>Aviso Prévio Indenizado:</span> <span>${formatBRL(results.avisoPrevio)}</span></p>`;
        if (results.decimoTerceiroProporcional > 0) html += `<p><span>13º Salário Proporcional:</span> <span>${formatBRL(results.decimoTerceiroProporcional)}</span></p>`;
        if (results.feriasVencidas > 0) html += `<p><span>Férias Vencidas:</span> <span>${formatBRL(results.feriasVencidas)}</span></p>`;
        if (results.tercoFeriasVencidas > 0) html += `<p><span>1/3 sobre Férias Vencidas:</span> <span>${formatBRL(results.tercoFeriasVencidas)}</span></p>`;
        if (results.feriasProporcionais > 0) html += `<p><span>Férias Proporcionais:</span> <span>${formatBRL(results.feriasProporcionais)}</span></p>`;
        if (results.tercoFeriasProporcionais > 0) html += `<p><span>1/3 sobre Férias Proporcionais:</span> <span>${formatBRL(results.tercoFeriasProporcionais)}</span></p>`;
        if (results.multaFgts > 0) html += `<p><span>Multa 40% FGTS (Estimativa):</span> <span>${formatBRL(results.multaFgts)}</span></p>`;
        
        html += `<p class="total-verbas"><span><strong>TOTAL BRUTO ESTIMADO:</strong></span> <span><strong>${formatBRL(results.total)}</strong></span></p>`;
        
        if (results.observacoes.length > 0) {
            html += '<div class="results-observations"><h4>Observações:</h4><ul>';
            results.observacoes.forEach(obs => {
                html += `<li>${obs}</li>`;
            });
            html += '</ul></div>';
        }

        outputDiv.innerHTML = html;
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
});