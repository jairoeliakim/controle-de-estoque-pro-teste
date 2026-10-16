import { InvoiceData, InvoiceItem, ItemCategory, MatchConfidence, StockItem, StockUnit, Supplier } from '../types';
import { findSupplierInDatabase, formatCNPJ } from './cnpjValidator';

/**
 * Normaliza strings para busca e comparação de nomes de produtos
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chave de acesso de DF-e (NT Conjunta 2025.001): 44 posições, e somente o campo do CNPJ
 * (posições 7 a 18) aceita letras: [0-9]{6}[A-Z0-9]{12}[0-9]{26}
 */
export const ACCESS_KEY_PATTERN = /^[0-9]{6}[A-Z0-9]{12}[0-9]{26}$/;

/**
 * Limpa/normaliza o que o usuário digita ou cola: maiúsculas, sem separadores, no máximo 44 caracteres,
 * e descarta letras fora do campo do CNPJ (que só aceita números nas demais posições).
 */
export function cleanAccessKey(input: string): string {
  const alnum = (input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let out = '';
  for (const ch of alnum) {
    if (out.length >= 44) break;
    const isLetter = ch >= 'A' && ch <= 'Z';
    const pos = out.length;
    if (isLetter && (pos < 6 || pos >= 18)) continue; // letra só é válida nas posições 7-18
    out += ch;
  }
  return out;
}

/**
 * Valida o formato da chave de acesso (44 posições, letras apenas no campo do CNPJ)
 */
export function isValidAccessKeyFormat(key: string): boolean {
  return ACCESS_KEY_PATTERN.test((key || '').toUpperCase());
}

/**
 * Valida o DV (módulo 11, pesos 2 a 9 da direita para a esquerda) da chave de acesso.
 * Caracteres alfanuméricos usam o valor ASCII - 48 (mesma regra do CNPJ alfanumérico).
 */
export function isAccessKeyCheckDigitValid(key: string): boolean {
  const k = (key || '').toUpperCase();
  if (!ACCESS_KEY_PATTERN.test(k)) return false;
  let sum = 0;
  let weight = 2;
  for (let i = 42; i >= 0; i--) {
    sum += (k.charCodeAt(i) - 48) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  const dv = rest === 0 || rest === 1 ? 0 : 11 - rest;
  return String(dv) === k[43];
}

/**
 * Extrai a chave de acesso de 44 posições (numérica ou com CNPJ alfanumérico) de qualquer texto,
 * URL de QR Code ou leitor de código de barras
 */
export function extractAccessKey(input: string): string | null {
  if (!input) return null;
  const cleanInput = input.trim();

  // Caso 1: URL de QR Code da SEFAZ (contém ?p= ou /qrcode?p=)
  // Exemplo: https://www.sefaz.sp.gov.br/nfce/qrcode?p=35260900000000000001550010001428571098765432|2|1|1|...
  if (cleanInput.includes('?p=') || cleanInput.includes('&p=')) {
    const pParam = cleanInput.split(/[?&]p=/)[1];
    if (pParam) {
      const firstPart = pParam.split('|')[0];
      const candidate = firstPart.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (candidate.length >= 44 && ACCESS_KEY_PATTERN.test(candidate.substring(0, 44))) {
        return candidate.substring(0, 44);
      }
    }
  }

  // Caso 2: Chave direta (com ou sem espaços/pontos), em maiúsculas ou minúsculas
  const compact = cleanInput.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length === 44 && ACCESS_KEY_PATTERN.test(compact)) {
    return compact;
  }

  // Caso 3: URL/texto qualquer que contenha uma sequência de 44 posições no formato da chave
  const match = cleanInput.toUpperCase().match(/\b[0-9]{6}[A-Z0-9]{12}[0-9]{26}\b/);
  if (match) {
    return match[0];
  }

  return null;
}

/**
 * Formata a chave de acesso em blocos de 4 caracteres para visualização legível
 */
export function formatAccessKey(key: string): string {
  const clean = cleanAccessKey(key);
  return clean.replace(/([A-Z0-9]{4})(?=[A-Z0-9])/g, '$1 ').trim();
}

/**
 * Calcula a similaridade entre o produto da nota e um item do estoque
 */
export function calculateMatchScore(invoiceName: string, stockItem: StockItem): { score: number; confidence: MatchConfidence } {
  const normInvoice = normalizeText(invoiceName);
  const normStock = normalizeText(stockItem.name);

  // Exact match
  if (normInvoice === normStock) {
    return { score: 1.0, confidence: 'exato' };
  }

  // Code match (se a nota tiver o mesmo código)
  if (stockItem.code && normInvoice.includes(normalizeText(stockItem.code))) {
    return { score: 0.95, confidence: 'exato' };
  }

  const invoiceWords = normInvoice.split(' ').filter((w) => w.length > 2);
  const stockWords = normStock.split(' ').filter((w) => w.length > 2);

  if (invoiceWords.length === 0 || stockWords.length === 0) {
    return { score: 0, confidence: 'novo' };
  }

  let matchingWordsCount = 0;
  for (const word of invoiceWords) {
    if (stockWords.some((sw) => sw.includes(word) || word.includes(sw))) {
      matchingWordsCount++;
    }
  }

  const score = (matchingWordsCount * 2) / (invoiceWords.length + stockWords.length);

  if (score >= 0.6) {
    return { score, confidence: 'alto' };
  } else if (score >= 0.3) {
    return { score, confidence: 'alto' };
  }

  return { score, confidence: 'novo' };
}

/**
 * Encontra a melhor correspondência no estoque para um produto da nota
 */
export function findBestStockMatch(
  productName: string,
  stockItems: StockItem[]
): { item: StockItem | null; confidence: MatchConfidence } {
  let bestItem: StockItem | null = null;
  let highestScore = 0;
  let bestConfidence: MatchConfidence = 'novo';

  for (const item of stockItems) {
    const { score, confidence } = calculateMatchScore(productName, item);
    if (score > highestScore && score >= 0.3) {
      highestScore = score;
      bestItem = item;
      bestConfidence = confidence;
    }
  }

  return { item: bestItem, confidence: bestConfidence };
}

/**
 * Sugere categoria padrão a partir do nome ou NCM
 */
export function guessItemCategory(name: string): ItemCategory {
  const norm = normalizeText(name);
  if (norm.includes('picanha') || norm.includes('carne') || norm.includes('bovino') || norm.includes('file') || norm.includes('hamburguer') || norm.includes('blend') || norm.includes('frango')) {
    return 'porcionamento';
  }
  if (norm.includes('batata') || norm.includes('camarao') || norm.includes('queijo') || norm.includes('petisco') || norm.includes('pastel') || norm.includes('mandioca') || norm.includes('empanado')) {
    return 'petisco';
  }
  if (norm.includes('cerveja') || norm.includes('refrigerante') || norm.includes('agua') || norm.includes('suco') || norm.includes('vodka') || norm.includes('gin') || norm.includes('chopp')) {
    return 'bebida';
  }
  if (norm.includes('guardanapo') || norm.includes('embalagem') || norm.includes('copo') || norm.includes('canudo') || norm.includes('sacola') || norm.includes('filme') || norm.includes('aluminio')) {
    return 'consumo';
  }
  if (norm.includes('detergente') || norm.includes('sabao') || norm.includes('desengordurante') || norm.includes('cloro') || norm.includes('sanitizante') || norm.includes('alcool')) {
    return 'limpeza';
  }
  return 'outro';
}

/**
 * Sugere unidade de estoque compatível a partir da unidade da nota
 */
export function guessStockUnit(uCom: string): StockUnit {
  const norm = uCom.toUpperCase().trim();
  if (norm === 'KG' || norm === 'KILO') return 'kg';
  if (norm === 'G' || norm === 'GR') return 'g';
  if (norm === 'L' || norm === 'LT' || norm === 'LITRO') return 'l';
  if (norm === 'ML') return 'ml';
  if (norm === 'CX' || norm === 'CAIXA') return 'cx';
  if (norm === 'FD' || norm === 'FARDO') return 'fd';
  if (norm === 'PCT' || norm === 'PACOTE') return 'pct';
  return 'un';
}

/**
 * Sugere o fator de conversão de unidade
 */
export function guessConversionFactor(invoiceUnit: string, stockUnit?: StockUnit): number {
  const iu = invoiceUnit.toUpperCase().trim();
  if (stockUnit === 'un') {
    if (iu === 'CX' || iu === 'CAIXA') return 12; // Padrão caixa 12 unidades
    if (iu === 'FD' || iu === 'FARDO') return 6; // Padrão fardo 6 unidades
    if (iu === 'PCT' || iu === 'PACOTE') return 10;
  }
  if (stockUnit === 'kg' && (iu === 'G' || iu === 'GR')) {
    return 0.001;
  }
  if (stockUnit === 'l' && iu === 'ML') {
    return 0.001;
  }
  return 1;
}

/**
 * Parser de XML de NF-e brasileira oficial
 */
export function parseNFeXml(xmlText: string, stockItems: StockItem[], suppliers: Supplier[]): InvoiceData {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

  // Check for XML parse errors
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error('O arquivo XML fornecido não é válido ou está corrompido.');
  }

  // Chave de Acesso no infNFe Id="NFe352609..."
  const infNFe = xmlDoc.querySelector('infNFe');
  let accessKey = '';
  if (infNFe) {
    const rawId = infNFe.getAttribute('Id') || '';
    accessKey = cleanAccessKey(rawId.replace(/^NFe/i, ''));
  }

  // Ide
  const nNF = xmlDoc.querySelector('ide > nNF')?.textContent || '000001';
  const serie = xmlDoc.querySelector('ide > serie')?.textContent || '1';
  const dhEmi = xmlDoc.querySelector('ide > dhEmi')?.textContent || new Date().toISOString();
  const natOp = xmlDoc.querySelector('ide > natOp')?.textContent || 'Venda de mercadorias';

  // Emitente
  const emitCnpj = xmlDoc.querySelector('emit > CNPJ')?.textContent || '';
  const emitXNome = xmlDoc.querySelector('emit > xNome')?.textContent || 'Fornecedor Identificado na NF-e';
  const emitXFant = xmlDoc.querySelector('emit > xFant')?.textContent || emitXNome;
  const emitFone = xmlDoc.querySelector('emit > enderEmit > fone')?.textContent || '';
  const emitUF = xmlDoc.querySelector('emit > enderEmit > UF')?.textContent || 'SP';

  // Find supplier match in existing suppliers
  const supplierLookup = findSupplierInDatabase(suppliers, emitCnpj, emitXNome);
  const matchedSupplier = supplierLookup.supplier;

  // Total
  const vProdTotal = parseFloat(xmlDoc.querySelector('total > ICMSTot > vProd')?.textContent || '0');
  const vFreteTotal = parseFloat(xmlDoc.querySelector('total > ICMSTot > vFrete')?.textContent || '0');
  const vNFTotal = parseFloat(xmlDoc.querySelector('total > ICMSTot > vNF')?.textContent || '0');

  // Produtos (det)
  const detNodes = xmlDoc.querySelectorAll('det');
  const items: InvoiceItem[] = [];

  detNodes.forEach((det, index) => {
    const cProd = det.querySelector('prod > cProd')?.textContent || `PROD-${index + 1}`;
    const xProd = det.querySelector('prod > xProd')?.textContent || `Produto ${index + 1}`;
    const ncm = det.querySelector('prod > NCM')?.textContent || '';
    const cfop = det.querySelector('prod > CFOP')?.textContent || '';
    const uCom = det.querySelector('prod > uCom')?.textContent || 'UN';
    const qCom = parseFloat(det.querySelector('prod > qCom')?.textContent || '1');
    const vUnCom = parseFloat(det.querySelector('prod > vUnCom')?.textContent || '0');
    const vProd = parseFloat(det.querySelector('prod > vProd')?.textContent || `${qCom * vUnCom}`);

    // Lote e validade (rastro)
    const nLote = det.querySelector('prod > rastro > nLote')?.textContent || `LT-${new Date().getFullYear()}${String(index + 1).padStart(3, '0')}`;
    const dVal = det.querySelector('prod > rastro > dVal')?.textContent || '';

    // Match with stock
    const { item: matchedStockItem, confidence } = findBestStockMatch(xProd, stockItems);

    const conversionFactor = guessConversionFactor(uCom, matchedStockItem?.unit);

    items.push({
      id: `inv-item-${index + 1}`,
      itemCode: cProd,
      name: xProd,
      ncm,
      cfop,
      unit: uCom,
      quantity: qCom,
      unitPrice: vUnCom,
      totalPrice: vProd,
      batchNumber: nLote,
      expiryDate: dVal || undefined,
      matchedStockItemId: matchedStockItem?.id || '',
      matchedStockItemName: matchedStockItem?.name || '',
      matchConfidence: confidence,
      conversionFactor,
      targetStockUnit: matchedStockItem?.unit || guessStockUnit(uCom),
      applied: true,
      isNewItem: !matchedStockItem,
      newItemCategory: guessItemCategory(xProd),
    });
  });

  return {
    id: `inv-${Date.now()}`,
    accessKey: accessKey || `352609${Math.random().toString().slice(2, 40)}`,
    number: nNF,
    series: serie,
    issueDate: dhEmi,
    natureOfOperation: natOp,
    supplierCnpj: formatCNPJ(emitCnpj),
    supplierName: emitXNome,
    supplierTradeName: emitXFant,
    supplierPhone: emitFone,
    supplierState: emitUF,
    matchedSupplierId: matchedSupplier?.id,
    totalProductsValue: vProdTotal || items.reduce((acc, it) => acc + it.totalPrice, 0),
    totalFreightValue: vFreteTotal,
    totalInvoiceValue: vNFTotal || items.reduce((acc, it) => acc + it.totalPrice, 0),
    items,
    sourceType: 'xml',
    status: 'pre_importado',
  };
}

/**
 * Notas Fiscais Demonstrativas para teste imediato com 1 clique
 */
export const DEMO_INVOICES: {
  key: string;
  title: string;
  supplierName: string;
  description: string;
  categoryTag: string;
  data: (stockItems: StockItem[], suppliers: Supplier[]) => InvoiceData;
}[] = [
  {
    key: '35260900000000000001550010001428571098765432',
    title: 'NF-e 142857 - Distribuidora Alimentos Gourmet',
    supplierName: 'Distribuidora Alimentos Gourmet & Fritos',
    description: 'Entrada de batatas congeladas, camarão empanado e queijo coalho com preços atualizados.',
    categoryTag: 'Congelados & Petiscos',
    data: (stockItems, suppliers) => {
      const sup = suppliers.find((s) => s.id === 'sup-1') || suppliers[0];
      const batataStock = stockItems.find((it) => it.id === 'item-5');
      const camaraoStock = stockItems.find((it) => it.id === 'item-6');
      const queijoStock = stockItems.find((it) => it.id === 'item-7');

      return {
        id: `demo-nfe-1-${Date.now()}`,
        accessKey: '35260900000000000001550010001428571098765432',
        number: '142857',
        series: '1',
        issueDate: new Date().toISOString(),
        natureOfOperation: 'Venda de mercadoria adquirida de terceiros',
        supplierCnpj: sup?.cnpj || '00.000.000/0000-00',
        supplierName: sup?.name || 'Distribuidora Alimentos Gourmet & Fritos LTDA',
        supplierTradeName: 'Alimentos Gourmet Express',
        supplierPhone: sup?.phone || '5511988887777',
        supplierEmail: sup?.email || 'pedidos@alimentosgourmet.com.br',
        supplierState: 'SP',
        matchedSupplierId: sup?.id,
        totalProductsValue: 1284.5,
        totalFreightValue: 0,
        totalInvoiceValue: 1284.5,
        sourceType: 'chave',
        status: 'pre_importado',
        items: [
          {
            id: 'demo-1-1',
            itemCode: 'BAT-CONG-9X9',
            name: 'BATATA FRITA PALITO CONGELADA 9X9MM 2.5KG',
            ncm: '20041000',
            cfop: '5102',
            unit: 'KG',
            quantity: 50.0,
            unitPrice: 11.5, // Leve aumento de preço (de R$ 11,20 para R$ 11,50)
            totalPrice: 575.0,
            batchNumber: 'LOTE-BAT-2026B',
            expiryDate: '2026-12-15',
            matchedStockItemId: batataStock?.id || 'item-5',
            matchedStockItemName: batataStock?.name || 'Batata Frita Palito Congelada 9x9mm',
            matchConfidence: 'exato',
            conversionFactor: 1,
            targetStockUnit: 'kg',
            applied: true,
          },
          {
            id: 'demo-1-2',
            itemCode: 'CAM-EMP-MED',
            name: 'CAMARAO EMPANADO PRE FRITO MEDIO PCT 1KG',
            ncm: '16052100',
            cfop: '5102',
            unit: 'KG',
            quantity: 12.0,
            unitPrice: 38.0, // Preço estável
            totalPrice: 456.0,
            batchNumber: 'LOTE-CAM-0926',
            expiryDate: '2026-11-20',
            matchedStockItemId: camaraoStock?.id || 'item-6',
            matchedStockItemName: camaraoStock?.name || 'Camarão Empanado Pré-frito (Tamanho Médio)',
            matchConfidence: 'exato',
            conversionFactor: 1,
            targetStockUnit: 'kg',
            applied: true,
          },
          {
            id: 'demo-1-3',
            itemCode: 'QJO-COALHO-ESP',
            name: 'QUEIJO COALHO ESPETO TRADICIONAL PACOTE 400G',
            ncm: '04069020',
            cfop: '5102',
            unit: 'UN',
            quantity: 15,
            unitPrice: 16.9, // Pequena redução no custo
            totalPrice: 253.5,
            batchNumber: 'LOTE-QJO-448',
            expiryDate: '2026-10-30',
            matchedStockItemId: queijoStock?.id || 'item-7',
            matchedStockItemName: queijoStock?.name || 'Queijo Coalho em Espetos (Pacote c/ 7un)',
            matchConfidence: 'alto',
            conversionFactor: 1,
            targetStockUnit: 'un',
            applied: true,
          },
        ],
      };
    },
  },
  {
    key: '35260998765432000111550020000984321012345678',
    title: 'NF-e 098432 - Frigorífico Central Carnes Nobres',
    supplierName: 'Frigorífico Central Carnes & Porções',
    description: 'Reposição de cortes bovinos maturados, hambúrguer artesanal e filé de frango.',
    categoryTag: 'Carnes & Porcionamento',
    data: (stockItems, suppliers) => {
      const sup = suppliers.find((s) => s.id === 'sup-2') || suppliers[1];
      const picanhaStock = stockItems.find((it) => it.id === 'item-1');
      const burgerStock = stockItems.find((it) => it.id === 'item-2');
      const frangoStock = stockItems.find((it) => it.id === 'item-3');

      return {
        id: `demo-nfe-2-${Date.now()}`,
        accessKey: '35260998765432000111550020000984321012345678',
        number: '098432',
        series: '2',
        issueDate: new Date().toISOString(),
        natureOfOperation: 'Venda de produtos de fabricação própria',
        supplierCnpj: sup?.cnpj || '98.765.432/0001-11',
        supplierName: sup?.name || 'Frigorífico Central Carnes & Porções LTDA',
        supplierTradeName: 'Frigorífico Central',
        supplierPhone: sup?.phone || '5511977776666',
        supplierEmail: sup?.email || 'vendas@frigorificocentral.com.br',
        supplierState: 'SP',
        matchedSupplierId: sup?.id,
        totalProductsValue: 2473.0,
        totalFreightValue: 0,
        totalInvoiceValue: 2473.0,
        sourceType: 'chave',
        status: 'pre_importado',
        items: [
          {
            id: 'demo-2-1',
            itemCode: 'CAR-PIC-250',
            name: 'PICANHA BOVINA FATIADA MATURADA PORC 250G',
            ncm: '02013000',
            cfop: '5101',
            unit: 'KG',
            quantity: 20.0,
            unitPrice: 77.9,
            totalPrice: 1558.0,
            batchNumber: 'LOTE-FRIG-0926-A',
            expiryDate: '2026-10-18',
            matchedStockItemId: picanhaStock?.id || 'item-1',
            matchedStockItemName: picanhaStock?.name || 'Picanha Bovina Fatiada (Porção 250g)',
            matchConfidence: 'exato',
            conversionFactor: 1,
            targetStockUnit: 'kg',
            applied: true,
          },
          {
            id: 'demo-2-2',
            itemCode: 'HMB-ART-180',
            name: 'BLEND HAMBURGUER ARTESANAL RESFRIADO 180G',
            ncm: '16025000',
            cfop: '5101',
            unit: 'UN',
            quantity: 80,
            unitPrice: 6.75,
            totalPrice: 540.0,
            batchNumber: 'LOTE-HMB-112',
            expiryDate: '2026-10-02',
            matchedStockItemId: burgerStock?.id || 'item-2',
            matchedStockItemName: burgerStock?.name || 'Blend Hambúrguer Artesanal 180g',
            matchConfidence: 'exato',
            conversionFactor: 1,
            targetStockUnit: 'un',
            applied: true,
          },
          {
            id: 'demo-2-3',
            itemCode: 'FRG-MAR-CUB',
            name: 'FILE DE PEITO DE FRANGO MARINADO CUBOS RESFR',
            ncm: '02071400',
            cfop: '5101',
            unit: 'KG',
            quantity: 16.0,
            unitPrice: 23.4,
            totalPrice: 375.0,
            batchNumber: 'LOTE-FRG-78',
            expiryDate: '2026-10-01',
            matchedStockItemId: frangoStock?.id || 'item-3',
            matchedStockItemName: frangoStock?.name || 'Filé de Frango Marinado em Cubos',
            matchConfidence: 'alto',
            conversionFactor: 1,
            targetStockUnit: 'kg',
            applied: true,
          },
        ],
      };
    },
  },
  {
    key: '35260967890123000122550010000552141054321098',
    title: 'NF-e 055214 - Cervejarias & Bebidas Integradas',
    supplierName: 'Cervejarias & Bebidas Integradas',
    description: 'Entrada de cervejas especiais (caixa c/ 24) e refrigerantes (fardo c/ 12) com fator de conversão.',
    categoryTag: 'Bebidas & Bar',
    data: (stockItems, suppliers) => {
      const sup = suppliers.find((s) => s.id === 'sup-4') || suppliers[3];
      const heinekenStock = stockItems.find((it) => it.id === 'item-10');
      const cocaStock = stockItems.find((it) => it.id === 'item-11');
      const ipaStock = stockItems.find((it) => it.id === 'item-12');

      return {
        id: `demo-nfe-3-${Date.now()}`,
        accessKey: '35260967890123000122550010000552141054321098',
        number: '055214',
        series: '1',
        issueDate: new Date().toISOString(),
        natureOfOperation: 'Venda de bebidas sob regime de ST',
        supplierCnpj: sup?.cnpj || '67.890.123/0001-22',
        supplierName: sup?.name || 'Cervejarias & Bebidas Integradas LTDA',
        supplierTradeName: 'Bebidas Integradas SP',
        supplierPhone: sup?.phone || '5511955554444',
        supplierEmail: sup?.email || 'atendimento@bebidasintegradas.com.br',
        supplierState: 'SP',
        matchedSupplierId: sup?.id,
        totalProductsValue: 1616.4,
        totalFreightValue: 40.0,
        totalInvoiceValue: 1656.4,
        sourceType: 'chave',
        status: 'pre_importado',
        items: [
          {
            id: 'demo-3-1',
            itemCode: 'CERV-HEIN-330',
            name: 'CERVEJA HEINEKEN PREMIUM LAGER LONG NECK 330ML',
            ncm: '22030000',
            cfop: '5405',
            unit: 'UN',
            quantity: 120, // 5 caixas de 24
            unitPrice: 5.85,
            totalPrice: 702.0,
            batchNumber: 'LOTE-HEIN-334A',
            expiryDate: '2027-04-30',
            matchedStockItemId: heinekenStock?.id || 'item-10',
            matchedStockItemName: heinekenStock?.name || 'Cerveja Heineken Long Neck 330ml',
            matchConfidence: 'exato',
            conversionFactor: 1,
            targetStockUnit: 'un',
            applied: true,
          },
          {
            id: 'demo-3-2',
            itemCode: 'REFR-COCA-350',
            name: 'REFRIGERANTE COCA COLA ORIGINAL LATA 350ML',
            ncm: '22021000',
            cfop: '5405',
            unit: 'UN',
            quantity: 144, // 12 fardos de 12
            unitPrice: 3.1,
            totalPrice: 446.4,
            batchNumber: 'LOTE-COCA-998',
            expiryDate: '2027-03-15',
            matchedStockItemId: cocaStock?.id || 'item-11',
            matchedStockItemName: cocaStock?.name || 'Refrigerante Coca-Cola 350ml Lata',
            matchConfidence: 'exato',
            conversionFactor: 1,
            targetStockUnit: 'un',
            applied: true,
          },
          {
            id: 'demo-3-3',
            itemCode: 'CERV-IPA-355',
            name: 'CERVEJA ARTESANAL IPA LONG NECK 355ML',
            ncm: '22030000',
            cfop: '5405',
            unit: 'UN',
            quantity: 72,
            unitPrice: 6.5,
            totalPrice: 468.0,
            batchNumber: 'LOTE-IPA-2026',
            expiryDate: '2026-11-20',
            matchedStockItemId: ipaStock?.id || 'item-12',
            matchedStockItemName: ipaStock?.name || 'Cerveja Artesanal IPA Long Neck 355ml',
            matchConfidence: 'exato',
            conversionFactor: 1,
            targetStockUnit: 'un',
            applied: true,
          },
        ],
      };
    },
  },
  {
    key: '35260945123789000144550010000331291087654321',
    title: 'NF-e 033129 - Nota Mista com Item Novo Não Cadastrado',
    supplierName: 'Distribuidora Alimentos Gourmet & Fritos',
    description: 'Inclui item já existente (Molho Barbecue) e um ITEM NOVO ("Anéis de Cebola Empanados"). Demonstra o fluxo de cadastro instantâneo.',
    categoryTag: 'Item Novo + Estoque',
    data: (stockItems, suppliers) => {
      const sup = suppliers.find((s) => s.id === 'sup-1') || suppliers[0];
      const molhoStock = stockItems.find((it) => it.id === 'item-4');

      return {
        id: `demo-nfe-4-${Date.now()}`,
        accessKey: '35260945123789000144550010000331291087654321',
        number: '033129',
        series: '1',
        issueDate: new Date().toISOString(),
        natureOfOperation: 'Venda de mercadoria',
        supplierCnpj: sup?.cnpj || '00.000.000/0000-00',
        supplierName: sup?.name || 'Distribuidora Alimentos Gourmet & Fritos LTDA',
        supplierTradeName: 'Alimentos Gourmet Express',
        supplierPhone: sup?.phone || '5511988887777',
        supplierEmail: sup?.email || 'pedidos@alimentosgourmet.com.br',
        supplierState: 'SP',
        matchedSupplierId: sup?.id,
        totalProductsValue: 695.0,
        totalFreightValue: 0,
        totalInvoiceValue: 695.0,
        sourceType: 'chave',
        status: 'pre_importado',
        items: [
          {
            id: 'demo-4-1',
            itemCode: 'MOL-BBQ-1L',
            name: 'MOLHO BARBECUE RUSTICO ARTESANAL GALAO 1L',
            ncm: '21039021',
            cfop: '5102',
            unit: 'L',
            quantity: 10.0,
            unitPrice: 16.5,
            totalPrice: 165.0,
            batchNumber: 'LOTE-BBQ-98',
            expiryDate: '2026-12-10',
            matchedStockItemId: molhoStock?.id || 'item-4',
            matchedStockItemName: molhoStock?.name || 'Molho Barbecue Rústico Artesanal',
            matchConfidence: 'exato',
            conversionFactor: 1,
            targetStockUnit: 'l',
            applied: true,
          },
          {
            id: 'demo-4-2',
            itemCode: 'PET-ANEIS-CEB',
            name: 'ANEIS DE CEBOLA EMPANADOS ONION RINGS PACOTE 1.5KG',
            ncm: '20049000',
            cfop: '5102',
            unit: 'KG',
            quantity: 20.0,
            unitPrice: 26.5,
            totalPrice: 530.0,
            batchNumber: 'LOTE-ONION-45',
            expiryDate: '2026-11-15',
            matchedStockItemId: '',
            matchedStockItemName: '',
            matchConfidence: 'novo', // ITEM NOVO!
            conversionFactor: 1,
            targetStockUnit: 'kg',
            applied: true,
            isNewItem: true,
            newItemCategory: 'petisco',
          },
        ],
      };
    },
  },
  {
    key: '35260903456789000188550010000892011033445566',
    title: 'NF-e 089201 - Laticínios Serra da Canastra (Fornecedor Não Cadastrado)',
    supplierName: 'Laticínios Serra da Canastra LTDA',
    description: 'Demonstra fornecedor novo não cadastrado: validação de CNPJ oficial, cadastro instantâneo e vínculo imediato dos laticínios ao novo fornecedor.',
    categoryTag: 'Fornecedor Não Cadastrado',
    data: (stockItems, suppliers) => {
      const lookup = findSupplierInDatabase(
        suppliers,
        '03.456.789/0001-88',
        'Laticínios Serra da Canastra LTDA'
      );
      const queijoStock = stockItems.find((it) => it.id === 'item-7');

      return {
        id: `demo-nfe-5-${Date.now()}`,
        accessKey: '35260903456789000188550010000892011033445566',
        number: '089201',
        series: '1',
        issueDate: new Date().toISOString(),
        natureOfOperation: 'Venda de produtos laticínios artesanais',
        supplierCnpj: '03.456.789/0001-88',
        supplierName: 'Laticínios Serra da Canastra LTDA',
        supplierTradeName: 'Laticínios Serra da Canastra',
        supplierPhone: '5535998765432',
        supplierEmail: 'pedidos@serracanastra.com.br',
        supplierState: 'MG',
        matchedSupplierId: lookup.supplier?.id,
        totalProductsValue: 1420.0,
        totalFreightValue: 35.0,
        totalInvoiceValue: 1455.0,
        sourceType: 'chave',
        status: 'pre_importado',
        items: [
          {
            id: 'demo-5-1',
            itemCode: 'QUEI-MUS-4KG',
            name: 'QUEIJO MUSSARELA PECA BARRA 4KG RESFRIADO',
            ncm: '04061010',
            cfop: '5102',
            unit: 'KG',
            quantity: 24.0, // 6 peças de 4kg
            unitPrice: 38.5,
            totalPrice: 924.0,
            batchNumber: 'LOTE-CAN-884',
            expiryDate: '2026-12-20',
            matchedStockItemId: queijoStock?.id || '',
            matchedStockItemName: queijoStock ? queijoStock.name : '',
            matchConfidence: queijoStock ? 'alto' : 'novo',
            conversionFactor: 1,
            targetStockUnit: 'kg',
            applied: true,
            isNewItem: !queijoStock,
            newItemCategory: 'petisco',
          },
          {
            id: 'demo-5-2',
            itemCode: 'REQ-CREM-36',
            name: 'REQUEIJAO CREMOSO BALDE CULINARIO 3.6KG',
            ncm: '04061090',
            cfop: '5102',
            unit: 'UN',
            quantity: 4.0,
            unitPrice: 84.0,
            totalPrice: 336.0,
            batchNumber: 'LOTE-REQ-201',
            expiryDate: '2026-11-10',
            matchedStockItemId: '',
            matchedStockItemName: '',
            matchConfidence: 'novo',
            conversionFactor: 1,
            targetStockUnit: 'un',
            applied: true,
            isNewItem: true,
            newItemCategory: 'porcionamento',
          },
          {
            id: 'demo-5-3',
            itemCode: 'MANT-SAL-500',
            name: 'MANTEIGA PRIMEIRA QUALIDADE COM SAL POTE 500G',
            ncm: '04051000',
            cfop: '5102',
            unit: 'UN',
            quantity: 10.0,
            unitPrice: 16.0,
            totalPrice: 160.0,
            batchNumber: 'LOTE-MNT-93',
            expiryDate: '2026-12-05',
            matchedStockItemId: '',
            matchedStockItemName: '',
            matchConfidence: 'novo',
            conversionFactor: 1,
            targetStockUnit: 'un',
            applied: true,
            isNewItem: true,
            newItemCategory: 'consumo',
          },
        ],
      };
    },
  },
];
