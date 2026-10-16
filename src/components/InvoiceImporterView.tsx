import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  QrCode,
  Camera,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Package,
  Layers,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Calendar,
  Tag,
  Building2,
  DollarSign,
  Info,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Eye,
  Trash2,
  Copy,
  Sliders,
  HelpCircle,
  ShoppingCart,
  Clock,
  Link2,
  CheckCheck,
  Printer,
} from 'lucide-react';
import jsQR from 'jsqr';
import {
  InvoiceData,
  InvoiceItem,
  ItemCategory,
  MatchConfidence,
  StockItem,
  StockUnit,
  Supplier,
  UserRole,
  canImportInvoices,
  PurchaseOrder,
} from '../types';
import { PrintOrderModal } from './PrintOrderModal';
import {
  DEMO_INVOICES,
  extractAccessKey,
  findBestStockMatch,
  formatAccessKey,
  cleanAccessKey,
  isValidAccessKeyFormat,
  guessConversionFactor,
  guessItemCategory,
  guessStockUnit,
  parseNFeXml,
  normalizeText,
} from '../utils/invoiceParser';
import { formatCurrency, formatQuantity } from '../utils/formatters';
import { RegisterSupplierFromInvoiceModal } from './RegisterSupplierFromInvoiceModal';
import { findSupplierInDatabase, formatCNPJ, validateCNPJ, cleanCNPJ } from '../utils/cnpjValidator';

interface InvoiceImporterViewProps {
  items: StockItem[];
  suppliers: Supplier[];
  onConfirmInvoiceImport: (
    invoice: InvoiceData,
    updatedItems: StockItem[],
    newSuppliers?: Supplier[],
    linkedOrderId?: string,
    orderFulfillmentType?: 'total' | 'parcial',
    updatedOrder?: PurchaseOrder
  ) => void;
  importedInvoicesHistory: InvoiceData[];
  currentRole: UserRole;
  onNavigateToCatalog?: () => void;
  onNavigateToCompras?: () => void;
  onSaveSupplier?: (supplier: Supplier, updatedItems?: StockItem[]) => void;
  ordersHistory?: PurchaseOrder[];
  onUpdatePurchaseOrder?: (order: PurchaseOrder) => void;
  preselectedOrderId?: string | null;
  onClearPreselectedOrder?: () => void;
}

type InputMethod = 'chave' | 'qrcode' | 'xml';
type QrMode = 'camera' | 'upload' | 'link';

export const InvoiceImporterView: React.FC<InvoiceImporterViewProps> = ({
  items,
  suppliers,
  onConfirmInvoiceImport,
  importedInvoicesHistory,
  currentRole,
  onNavigateToCatalog,
  onNavigateToCompras,
  onSaveSupplier,
  ordersHistory = [],
  onUpdatePurchaseOrder,
  preselectedOrderId,
  onClearPreselectedOrder,
}) => {
  // Navigation & Sub-views
  const [activeTab, setActiveTab] = useState<'importar' | 'historico'>('importar');
  const [inputMethod, setInputMethod] = useState<InputMethod>('chave');

  // Key input state
  const [typedKey, setTypedKey] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);

  // QR Code Scanner state
  const [qrMode, setQrMode] = useState<QrMode>('camera');
  const [qrLinkInput, setQrLinkInput] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanAnimationRef = useRef<number | null>(null);

  // XML File input state
  const [dragOver, setDragOver] = useState(false);
  const [xmlFileName, setXmlFileName] = useState<string | null>(null);
  const [xmlError, setXmlError] = useState<string | null>(null);

  // Pre-imported Invoice Data
  const [activeInvoice, setActiveInvoice] = useState<InvoiceData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  // Supplier Registration from Invoice Modal state
  const [isRegisterSupplierModalOpen, setIsRegisterSupplierModalOpen] = useState(false);
  const [supplierRegistrationFeedback, setSupplierRegistrationFeedback] = useState<string | null>(null);
  const [newlyRegisteredSuppliers, setNewlyRegisteredSuppliers] = useState<Supplier[]>([]);

  // Selected Purchase Order to link with this invoice
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Printable Order Modal state
  const [printingOrder, setPrintingOrder] = useState<PurchaseOrder | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Combined suppliers list (prop suppliers + any newly registered during this view session)
  const allSuppliers = [...newlyRegisteredSuppliers, ...suppliers];

  // Filter open orders (pending, sent via whatsapp/email, or partially fulfilled)
  const openPurchaseOrders = React.useMemo(() => {
    return (ordersHistory || []).filter(
      (o) =>
        o.status === 'pendente' ||
        o.status === 'enviado_whatsapp' ||
        o.status === 'enviado_email' ||
        o.status === 'parcial'
    );
  }, [ordersHistory]);

  // Supplier lookup for active invoice
  const activeSupplierLookup = activeInvoice
    ? findSupplierInDatabase(allSuppliers, activeInvoice.supplierCnpj, activeInvoice.supplierName)
    : { found: false, supplier: null, matchType: null };

  const matchedSupplier =
    activeSupplierLookup.supplier ||
    (activeInvoice?.matchedSupplierId
      ? allSuppliers.find((s) => s.id === activeInvoice.matchedSupplierId)
      : null);

  // Matching open orders for active invoice supplier
  const matchingOpenOrdersForSupplier = React.useMemo(() => {
    if (!activeInvoice) return [];
    const cleanCnpj = activeInvoice.supplierCnpj ? cleanCNPJ(activeInvoice.supplierCnpj) : '';
    const supplierId = activeInvoice.matchedSupplierId;

    return openPurchaseOrders.filter((order) => {
      if (supplierId && order.supplierId === supplierId) return true;
      const orderSupplier = allSuppliers.find((s) => s.id === order.supplierId);
      if (cleanCnpj && orderSupplier?.cnpj && cleanCNPJ(orderSupplier.cnpj) === cleanCnpj) return true;
      const normOrderSup = normalizeText(order.supplierName || '');
      const normInvSup = normalizeText(activeInvoice.supplierName || '');
      if (normOrderSup && normInvSup && (normOrderSup.includes(normInvSup) || normInvSup.includes(normOrderSup))) {
        return true;
      }
      return false;
    });
  }, [activeInvoice, openPurchaseOrders, allSuppliers]);

  // When active invoice is set, if no order was manually selected yet, automatically select matching order if available
  useEffect(() => {
    if (activeInvoice && !selectedOrderId) {
      if (matchingOpenOrdersForSupplier.length > 0) {
        setSelectedOrderId(matchingOpenOrdersForSupplier[0].id);
      }
    }
  }, [activeInvoice, matchingOpenOrdersForSupplier, selectedOrderId]);

  // Sync selectedOrderId with preselectedOrderId prop if passed from Compras
  useEffect(() => {
    if (preselectedOrderId) {
      setSelectedOrderId(preselectedOrderId);
    }
  }, [preselectedOrderId]);

  const handleClearSelectedOrder = () => {
    setSelectedOrderId(null);
    if (onClearPreselectedOrder) {
      onClearPreselectedOrder();
    }
  };

  // Order Reconciliation Analysis
  const linkedOrderAnalysis = React.useMemo(() => {
    if (!activeInvoice || !selectedOrderId) return null;
    const linkedOrder = (ordersHistory || []).find((o) => o.id === selectedOrderId);
    if (!linkedOrder) return null;

    const appliedInvoiceItems = activeInvoice.items.filter((it) => it.applied);

    const itemReconciliation = linkedOrder.items.map((orderItem) => {
      // Find matching item in invoice
      const matchingInvItem = appliedInvoiceItems.find((inv) => {
        if (inv.matchedStockItemId && inv.matchedStockItemId === orderItem.itemId) return true;
        const normInv = normalizeText(inv.name);
        const normOrd = normalizeText(orderItem.itemName);
        return normInv.includes(normOrd) || normOrd.includes(normInv);
      });

      const quantityInThisInvoice = matchingInvItem
        ? matchingInvItem.quantity * (matchingInvItem.conversionFactor || 1)
        : 0;

      const previouslyReceived = orderItem.receivedQuantity || 0;
      const totalReceivedAfterThisInvoice = Number((previouslyReceived + quantityInThisInvoice).toFixed(2));
      const remainingAfterThisInvoice = Math.max(
        0,
        Number((orderItem.quantityToOrder - totalReceivedAfterThisInvoice).toFixed(2))
      );

      let itemStatus: 'total' | 'parcial' | 'pendente' | 'excesso';
      if (totalReceivedAfterThisInvoice >= orderItem.quantityToOrder) {
        itemStatus = totalReceivedAfterThisInvoice > orderItem.quantityToOrder ? 'excesso' : 'total';
      } else if (totalReceivedAfterThisInvoice > 0) {
        itemStatus = 'parcial';
      } else {
        itemStatus = 'pendente';
      }

      return {
        orderItem,
        matchingInvItem,
        quantityInThisInvoice,
        previouslyReceived,
        totalReceivedAfterThisInvoice,
        remainingAfterThisInvoice,
        itemStatus,
      };
    });

    const allItemsFulfilled = itemReconciliation.every(
      (rec) => rec.totalReceivedAfterThisInvoice >= rec.orderItem.quantityToOrder
    );

    const someItemsFulfilled = itemReconciliation.some(
      (rec) => rec.quantityInThisInvoice > 0 || rec.previouslyReceived > 0
    );

    const fulfillmentType: 'total' | 'parcial' = allItemsFulfilled ? 'total' : 'parcial';

    // Items present in invoice that were not in the purchase order
    const extraItemsInInvoice = appliedInvoiceItems.filter((inv) => {
      return !itemReconciliation.some((rec) => rec.matchingInvItem?.id === inv.id);
    });

    return {
      linkedOrder,
      itemReconciliation,
      allItemsFulfilled,
      someItemsFulfilled,
      fulfillmentType,
      extraItemsInInvoice,
    };
  }, [activeInvoice, selectedOrderId, ordersHistory]);

  const isSupplierRegistered = !!matchedSupplier;

  // Expandable items state
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Cleanup camera when leaving camera mode or unmounting
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (scanAnimationRef.current) {
      cancelAnimationFrame(scanAnimationRef.current);
      scanAnimationRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Câmera não suportada neste navegador.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setIsCameraActive(true);
        scanQrLoop();
      }
    } catch (err: any) {
      console.error('Erro ao abrir câmera:', err);
      setCameraError(
        err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
          ? 'Permissão de acesso à câmera negada. Habilite a câmera nas configurações do navegador ou use o modo Envio de Foto / Digitação da Chave.'
          : 'Não foi possível acessar a câmera do dispositivo. Use a opção de Envio de Imagem ou Chave de Acesso.'
      );
      setIsCameraActive(false);
    }
  };

  const scanQrLoop = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (qrCode && qrCode.data) {
          stopCamera();
          handleQrCodeScanned(qrCode.data);
          return;
        }
      }
    }
    scanAnimationRef.current = requestAnimationFrame(scanQrLoop);
  };

  // Handle QR code text decoded
  const handleQrCodeScanned = (qrText: string) => {
    const extractedKey = extractAccessKey(qrText);
    if (!extractedKey) {
      setCameraError('QR Code lido, porém não contém uma chave de NF-e válida da SEFAZ.');
      return;
    }
    processAccessKey(extractedKey, 'qrcode');
  };

  // Handle Image File Upload for QR Code
  const handleQrImageUpload = (file: File) => {
    setCameraError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setCameraError('Não foi possível processar a imagem do QR Code.');
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

        if (qrCode && qrCode.data) {
          handleQrCodeScanned(qrCode.data);
        } else {
          setCameraError(
            'Nenhum QR Code legível foi detectado na imagem. Certifique-se de que a imagem esteja nítida ou digite a chave de acesso.'
          );
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Process typed or scanned 44-digit access key
  const processAccessKey = (key: string, sourceType: 'chave' | 'qrcode') => {
    setKeyError(null);
    setIsProcessing(true);

    const cleanKey = cleanAccessKey(key);
    if (cleanKey.length !== 44 || !isValidAccessKeyFormat(cleanKey)) {
      setKeyError(`A chave de acesso da NF-e deve ter exatamente 44 caracteres (letras apenas no campo do CNPJ, posições 7 a 18) — atualmente ${cleanKey.length}.`);
      setIsProcessing(false);
      return;
    }

    // Check if this key matches one of our demo invoices
    const matchedDemo = DEMO_INVOICES.find((d) => d.key === cleanKey);
    let invoiceData: InvoiceData;

    if (matchedDemo) {
      invoiceData = matchedDemo.data(items, allSuppliers);
      invoiceData.sourceType = sourceType;
    } else {
      // Generate synthetic realistic invoice from real key structure
      // Format: cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8) + cDV(1)
      const cnpjRaw = cleanKey.substring(6, 20);
      const nNF = cleanKey.substring(25, 34).replace(/^0+/, '') || '10482';
      const serie = cleanKey.substring(22, 25).replace(/^0+/, '') || '1';
      const formattedCnpj = `${cnpjRaw.slice(0, 2)}.${cnpjRaw.slice(2, 5)}.${cnpjRaw.slice(5, 8)}/${cnpjRaw.slice(8, 12)}-${cnpjRaw.slice(12, 14)}`;

      // Try finding supplier by CNPJ or name in registered suppliers
      const lookup = findSupplierInDatabase(allSuppliers, formattedCnpj);
      const matchedSup = lookup.supplier;

      // Auto-match random stock items for demonstration if not a pre-stored key
      const sampleItems = items.slice(0, 3);
      invoiceData = {
        id: `inv-${Date.now()}`,
        accessKey: cleanKey,
        number: nNF,
        series: serie,
        issueDate: new Date().toISOString(),
        natureOfOperation: 'Venda de mercadoria adquirida de terceiros',
        supplierCnpj: formattedCnpj,
        supplierName: matchedSup?.name || 'Distribuidora e Indústria de Alimentos LTDA',
        supplierTradeName: matchedSup?.tradeName || matchedSup?.name || 'Distribuidora Parceira',
        supplierPhone: matchedSup?.phone || '5511999998888',
        supplierEmail: matchedSup?.email || 'pedidos@fornecedor.com.br',
        supplierState: 'SP',
        matchedSupplierId: matchedSup?.id,
        totalProductsValue: 890.0,
        totalInvoiceValue: 890.0,
        sourceType,
        status: 'pre_importado',
        items: sampleItems.map((stk, idx) => ({
          id: `item-gen-${idx + 1}`,
          itemCode: `COD-${idx + 100}`,
          name: `${stk.name.toUpperCase()} INDUSTRIAL`,
          ncm: '21069090',
          cfop: '5102',
          unit: stk.unit.toUpperCase(),
          quantity: 20,
          unitPrice: Number((stk.costPrice * 1.05).toFixed(2)),
          totalPrice: Number((20 * stk.costPrice * 1.05).toFixed(2)),
          batchNumber: `LT-${new Date().getFullYear()}${String(idx + 1).padStart(2, '0')}`,
          expiryDate: stk.currentBatchExpiry || '2026-11-30',
          matchedStockItemId: stk.id,
          matchedStockItemName: stk.name,
          matchConfidence: 'alto',
          conversionFactor: 1,
          targetStockUnit: stk.unit,
          applied: true,
        })),
      };
    }

    setTimeout(() => {
      setActiveInvoice(invoiceData);
      setIsProcessing(false);
      setImportSuccessMessage(null);
    }, 400);
  };

  // Load a demo invoice directly with 1-click
  const handleLoadDemo = (demoKey: string) => {
    setTypedKey(formatAccessKey(demoKey));
    processAccessKey(demoKey, 'chave');
  };

  // Handle XML File upload
  const handleXmlFile = (file: File) => {
    setXmlError(null);
    setXmlFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseNFeXml(text, items, allSuppliers);
        setActiveInvoice(parsed);
        setIsProcessing(false);
      } catch (err: any) {
        console.error('Erro ao ler XML de NF-e:', err);
        setXmlError(err?.message || 'Falha ao processar o arquivo XML. Certifique-se de que é um XML de NF-e válido.');
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      setXmlError('Erro ao abrir o arquivo selecionado.');
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };

  // Item modification in pre-import view
  const handleToggleItemApplied = (itemId: string) => {
    if (!activeInvoice) return;
    setActiveInvoice({
      ...activeInvoice,
      items: activeInvoice.items.map((it) => (it.id === itemId ? { ...it, applied: !it.applied } : it)),
    });
  };

  const handleUpdateItemStockMatch = (invoiceItemId: string, newStockItemId: string) => {
    if (!activeInvoice) return;
    const targetStock = items.find((s) => s.id === newStockItemId);

    setActiveInvoice({
      ...activeInvoice,
      items: activeInvoice.items.map((it) => {
        if (it.id !== invoiceItemId) return it;
        if (!targetStock) {
          return {
            ...it,
            matchedStockItemId: '',
            matchedStockItemName: '',
            matchConfidence: 'novo',
            isNewItem: true,
          };
        }
        return {
          ...it,
          matchedStockItemId: targetStock.id,
          matchedStockItemName: targetStock.name,
          matchConfidence: 'manual',
          targetStockUnit: targetStock.unit,
          conversionFactor: guessConversionFactor(it.unit, targetStock.unit),
          isNewItem: false,
        };
      }),
    });
  };

  const handleUpdateConversionFactor = (invoiceItemId: string, factor: number) => {
    if (!activeInvoice) return;
    setActiveInvoice({
      ...activeInvoice,
      items: activeInvoice.items.map((it) => (it.id === invoiceItemId ? { ...it, conversionFactor: Math.max(0.001, factor) } : it)),
    });
  };

  const handleUpdateExpiryDate = (invoiceItemId: string, expiry: string) => {
    if (!activeInvoice) return;
    setActiveInvoice({
      ...activeInvoice,
      items: activeInvoice.items.map((it) => (it.id === invoiceItemId ? { ...it, expiryDate: expiry } : it)),
    });
  };

  const handleUpdateNewItemCategory = (invoiceItemId: string, cat: ItemCategory) => {
    if (!activeInvoice) return;
    setActiveInvoice({
      ...activeInvoice,
      items: activeInvoice.items.map((it) => (it.id === invoiceItemId ? { ...it, newItemCategory: cat } : it)),
    });
  };

  // Supplier Registration & Linking Handlers
  const handleSupplierRegistered = (newSupplier: Supplier, linkAllInvoiceItems: boolean) => {
    // 1. Add to newly registered suppliers state
    setNewlyRegisteredSuppliers((prev) => {
      const exists = prev.some((s) => s.id === newSupplier.id);
      if (exists) return prev.map((s) => (s.id === newSupplier.id ? newSupplier : s));
      return [newSupplier, ...prev];
    });

    // 2. Call onSaveSupplier if provided
    if (onSaveSupplier) {
      onSaveSupplier(newSupplier);
    }

    // 3. Update active invoice state
    if (activeInvoice) {
      const productIds = activeInvoice.items.map((it) => it.matchedStockItemId || it.id);
      newSupplier.suppliedProductIds = productIds;

      setActiveInvoice((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          matchedSupplierId: newSupplier.id,
          supplierName: newSupplier.name,
          supplierCnpj: newSupplier.cnpj || prev.supplierCnpj,
          supplierPhone: newSupplier.phone,
          supplierEmail: newSupplier.email,
        };
      });

      setSupplierRegistrationFeedback(
        `Fornecedor "${newSupplier.name}" cadastrado com sucesso e validado pelo CNPJ! ${linkAllInvoiceItems ? `${activeInvoice.items.length} produto(s) da nota vinculados.` : ''}`
      );
    }
  };

  const handleSelectExistingSupplier = (supplierId: string) => {
    const sup = allSuppliers.find((s) => s.id === supplierId);
    if (!sup || !activeInvoice) return;

    setActiveInvoice((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        matchedSupplierId: sup.id,
        supplierName: sup.name,
        supplierCnpj: sup.cnpj || prev.supplierCnpj,
        supplierPhone: sup.phone || prev.supplierPhone,
        supplierEmail: sup.email || prev.supplierEmail,
      };
    });

    setSupplierRegistrationFeedback(
      `Nota fiscal nº ${activeInvoice.number} vinculada com sucesso ao fornecedor existente "${sup.name}".`
    );
  };

  // Confirm Import & Efetivação no Estoque
  const handleConfirmImport = () => {
    if (!activeInvoice) return;

    const appliedItems = activeInvoice.items.filter((it) => it.applied);
    if (appliedItems.length === 0) {
      alert('Selecione pelo menos um item da nota fiscal para dar entrada no estoque.');
      return;
    }

    // If supplier is not registered/linked, intercept and open the CNPJ validation registration modal
    if (!activeInvoice.matchedSupplierId && !isSupplierRegistered) {
      setIsRegisterSupplierModalOpen(true);
      return;
    }

    // Build updated items list
    let currentStockList = [...items];
    const newItemsToCreate: StockItem[] = [];

    // Check if supplier is registered
    let newSuppliersToAdd: Supplier[] = [...newlyRegisteredSuppliers];
    let supplierId = activeInvoice.matchedSupplierId;

    if (!supplierId && matchedSupplier) {
      supplierId = matchedSupplier.id;
    }

    const appliedProductIds: string[] = [];

    appliedItems.forEach((invItem) => {
      const addedQuantity = invItem.quantity * (invItem.conversionFactor || 1);
      const unitCost = invItem.unitPrice / (invItem.conversionFactor || 1);

      if (invItem.matchedStockItemId) {
        appliedProductIds.push(invItem.matchedStockItemId);
        // Update existing stock item
        currentStockList = currentStockList.map((stk) => {
          if (stk.id !== invItem.matchedStockItemId) return stk;
          return {
            ...stk,
            currentStock: Number((stk.currentStock + addedQuantity).toFixed(2)),
            costPrice: Number(unitCost.toFixed(2)),
            currentBatchExpiry: invItem.expiryDate || stk.currentBatchExpiry,
            primarySupplierId: supplierId || stk.primarySupplierId,
          };
        });
      } else {
        // Create new item in catalog
        const newItemId = `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        appliedProductIds.push(newItemId);
        const newStockItem: StockItem = {
          id: newItemId,
          name: invItem.name,
          code: invItem.itemCode || `NF-${invItem.id}`,
          category: invItem.newItemCategory || guessItemCategory(invItem.name),
          unit: (invItem.targetStockUnit || guessStockUnit(invItem.unit)) as StockUnit,
          currentStock: addedQuantity,
          minStock: Math.max(5, Math.round(addedQuantity * 0.3)),
          reorderPoint: Math.max(8, Math.round(addedQuantity * 0.5)),
          optimalStock: Math.max(15, Math.round(addedQuantity * 1.5)),
          costPrice: Number(unitCost.toFixed(2)),
          primarySupplierId: supplierId || 'sup-1',
          countDays: ['quarta', 'domingo'],
          currentBatchExpiry: invItem.expiryDate,
          location: 'Estoque Seco / Recebimento',
          lastCountDate: new Date().toISOString().split('T')[0],
        };
        newItemsToCreate.push(newStockItem);
      }
    });

    // Ensure newly registered supplier has all appliedProductIds
    newSuppliersToAdd = newSuppliersToAdd.map((s) => {
      if (s.id === supplierId) {
        const idSet = new Set(s.suppliedProductIds || []);
        appliedProductIds.forEach((id) => idSet.add(id));
        return {
          ...s,
          suppliedProductIds: Array.from(idSet),
        };
      }
      return s;
    });

    const finalItemsList = [...currentStockList, ...newItemsToCreate];

    // Fechamento Parcial ou Total do Pedido Vinculado
    let updatedOrder: PurchaseOrder | undefined;
    let fulfillmentType: 'total' | 'parcial' | undefined;

    if (linkedOrderAnalysis) {
      const { linkedOrder, itemReconciliation, allItemsFulfilled } = linkedOrderAnalysis;
      fulfillmentType = allItemsFulfilled ? 'total' : 'parcial';

      const updatedOrderItems = linkedOrder.items.map((ordItem) => {
        const rec = itemReconciliation.find((r) => r.orderItem.itemId === ordItem.itemId);
        return {
          ...ordItem,
          receivedQuantity: rec ? rec.totalReceivedAfterThisInvoice : (ordItem.receivedQuantity || 0),
        };
      });

      const todayStr = new Date().toLocaleDateString('pt-BR');
      const invoiceRef = `NF-e nº ${activeInvoice.number}`;
      const existingInvoices = linkedOrder.linkedInvoiceNumbers || [];
      const newInvoiceNumbers = Array.from(new Set([...existingInvoices, activeInvoice.number]));
      const existingInvoiceIds = linkedOrder.linkedInvoiceIds || [];
      const newInvoiceIds = Array.from(new Set([...existingInvoiceIds, activeInvoice.id]));

      const closureNote = allItemsFulfilled
        ? `Fechamento TOTAL pela ${invoiceRef} em ${todayStr}.`
        : `Fechamento PARCIAL pela ${invoiceRef} em ${todayStr}. Restam itens pendentes.`;

      updatedOrder = {
        ...linkedOrder,
        items: updatedOrderItems,
        status: allItemsFulfilled ? 'entregue' : 'parcial',
        fulfillmentType,
        fulfilledAt: new Date().toISOString(),
        linkedInvoiceNumbers: newInvoiceNumbers,
        linkedInvoiceIds: newInvoiceIds,
        notes: linkedOrder.notes ? `${linkedOrder.notes} | ${closureNote}` : closureNote,
      };
    }

    const completedInvoice: InvoiceData = {
      ...activeInvoice,
      status: 'efetivado',
      importedAt: new Date().toISOString(),
      importedBy: `${currentRole.toUpperCase()}`,
      matchedSupplierId: supplierId,
      linkedPurchaseOrderId: selectedOrderId || undefined,
      linkedPurchaseOrderNumber: linkedOrderAnalysis?.linkedOrder.orderNumber || selectedOrderId || undefined,
      orderFulfillmentType: fulfillmentType,
    };

    onConfirmInvoiceImport(
      completedInvoice,
      finalItemsList,
      newSuppliersToAdd.length > 0 ? newSuppliersToAdd : undefined,
      selectedOrderId || undefined,
      fulfillmentType,
      updatedOrder
    );

    const orderFeedback = updatedOrder
      ? fulfillmentType === 'total'
        ? ` • Pedido ${updatedOrder.orderNumber || updatedOrder.id} 100% FECHADO com sucesso!`
        : ` • Pedido ${updatedOrder.orderNumber || updatedOrder.id} marcado como ATENDIDO PARCIALMENTE (itens pendentes continuam em aberto).`
      : '';

    setImportSuccessMessage(
      `Entrada da NF-e nº ${completedInvoice.number} efetivada com sucesso! ${appliedItems.length} produto(s) atualizado(s) no estoque${orderFeedback}`
    );
  };

  const handleReset = () => {
    setActiveInvoice(null);
    setSelectedOrderId(null);
    setTypedKey('');
    setKeyError(null);
    setXmlFileName(null);
    setXmlError(null);
    setImportSuccessMessage(null);
    stopCamera();
  };

  // Calculation summaries for pre-import view
  const appliedCount = activeInvoice?.items.filter((it) => it.applied).length || 0;
  const totalAppliedValue =
    activeInvoice?.items.filter((it) => it.applied).reduce((acc, it) => acc + it.totalPrice, 0) || 0;
  const matchedCount = activeInvoice?.items.filter((it) => it.applied && it.matchedStockItemId).length || 0;
  const newItemsCount = activeInvoice?.items.filter((it) => it.applied && !it.matchedStockItemId).length || 0;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-800/80 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Leitor & Importador de NF-e / NFC-e</span>
              </span>
              <span className="text-xs text-slate-400">• SEFAZ Brasil</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">
              Entrada de Estoque por Nota Fiscal
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Importe produtos digitando a chave de 44 dígitos, lendo o QR Code impresso na DANFE com a câmera ou carregando o XML oficial. O sistema cruza os dados com o estoque em tempo real e atualiza custos e saldos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('importar');
                if (importSuccessMessage) handleReset();
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'importar'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>Importar Nota</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('historico')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'historico'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Histórico de Entradas ({importedInvoicesHistory.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {importSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-200">Sucesso na Entrada de Mercadorias!</h4>
              <p className="text-xs text-emerald-300/90">{importSuccessMessage}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {onNavigateToCatalog && (
              <button
                type="button"
                onClick={onNavigateToCatalog}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 transition-all flex items-center gap-1"
              >
                <span>Ver Catálogo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-all"
            >
              Importar Outra Nota
            </button>
          </div>
        </div>
      )}

      {/* TAB: HISTÓRICO DE ENTRADAS */}
      {activeTab === 'historico' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Notas Fiscais de Entrada Importadas</span>
              </h3>
              <p className="text-xs text-slate-400">
                Histórico de todas as notas fiscais cuja entrada de produtos foi confirmada no estoque.
              </p>
            </div>
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              Total: {importedInvoicesHistory.length} nota(s)
            </span>
          </div>

          {importedInvoicesHistory.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-400 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Nenhuma nota fiscal importada ainda</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Utilize o leitor de QR Code, a digitação da chave ou o upload do arquivo XML para pré-importar sua primeira nota fiscal.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('importar')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all shadow-md"
              >
                Importar Primeira Nota
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {importedInvoicesHistory.map((inv) => (
                <div
                  key={inv.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/70 pb-2.5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-100">
                          NF-e nº {inv.number} (Série {inv.series})
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Efetivada
                        </span>
                        {inv.linkedPurchaseOrderNumber && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                              inv.orderFulfillmentType === 'total'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            }`}
                          >
                            <Link2 className="w-2.5 h-2.5" />
                            <span>Pedido {inv.linkedPurchaseOrderNumber} ({inv.orderFulfillmentType === 'total' ? 'Fechamento Total' : 'Fechamento Parcial'})</span>
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 uppercase">
                          Via {inv.sourceType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>{inv.supplierName}</span>
                        <span className="text-slate-500">• CNPJ: {inv.supplierCnpj}</span>
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-base font-extrabold text-emerald-400 block">
                        {formatCurrency(inv.totalInvoiceValue)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {inv.importedAt ? new Date(inv.importedAt).toLocaleDateString('pt-BR') : 'Data recente'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="font-mono text-[11px] text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800 truncate max-w-md">
                      Chave: {formatAccessKey(inv.accessKey)}
                    </span>
                    <span className="font-semibold text-slate-300">
                      {inv.items.filter((it) => it.applied).length} produto(s) recebido(s)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: IMPORTAR NOTA (LEITOR OU PRÉ-IMPORTAÇÃO) */}
      {activeTab === 'importar' && !activeInvoice && (
        <div className="space-y-6">
          {/* SEÇÃO: PEDIDOS DE COMPRA EM ABERTO AGUARDANDO ENTREGA */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>Pedidos de Compra em Aberto</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                      {openPurchaseOrders.length} aguardando entrega
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Selecione um pedido para vincular a entrada da nota fiscal ou dê entrada avulsa escaneando a NF-e abaixo. O sistema fechará o pedido total ou parcialmente de acordo com as quantidades entregues.
                  </p>
                </div>
              </div>

              {selectedOrderId && (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-amber-300 font-semibold bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Vínculo selecionado: {openPurchaseOrders.find((o) => o.id === selectedOrderId)?.orderNumber || selectedOrderId}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleClearSelectedOrder}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Desmarcar seleção"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {selectedOrderId && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Pedido <strong>{openPurchaseOrders.find((o) => o.id === selectedOrderId)?.orderNumber || selectedOrderId}</strong> está ativo para vinculação! Digite a chave, escaneie o QR Code, envie o XML ou clique nas notas de teste abaixo para fechar o pedido (total ou parcial).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearSelectedOrder}
                  className="text-[11px] font-bold text-amber-400 underline hover:text-amber-200 self-end sm:self-auto shrink-0"
                >
                  Remover vínculo
                </button>
              </div>
            )}

            {openPurchaseOrders.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-950/60 rounded-xl border border-slate-800/80">
                Nenhum pedido de compra em aberto no momento. Todos os pedidos enviados já foram atendidos ou você pode gerar novos pedidos na aba de Compras.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {openPurchaseOrders.map((order) => {
                  const isSelected = selectedOrderId === order.id;
                  const isPartial = order.status === 'parcial';
                  const matchingDemo = DEMO_INVOICES.find((demo) => {
                    const demoData = demo.data(items, suppliers);
                    const cleanCnpj = cleanCNPJ(demoData.supplierCnpj);
                    const ordSup = allSuppliers.find((s) => s.id === order.supplierId);
                    return ordSup?.cnpj && cleanCNPJ(ordSup.cnpj) === cleanCnpj;
                  });

                  return (
                    <div
                      key={order.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/10 ring-2 ring-amber-500/40'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-amber-400">
                            {order.orderNumber || order.id}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isPartial
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : order.channelSent === 'whatsapp'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : order.channelSent === 'email'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            }`}
                          >
                            {isPartial
                              ? 'Parcialmente Recebido'
                              : order.channelSent === 'whatsapp'
                              ? 'Enviado WhatsApp'
                              : order.channelSent === 'email'
                              ? 'Enviado E-mail'
                              : 'Salvo / Pendente'}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-100 line-clamp-1">
                            {order.supplierName}
                          </h4>
                          <span className="text-[11px] text-slate-400">
                            {new Date(order.createdAt).toLocaleDateString('pt-BR')} • {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                          </span>
                        </div>

                        <div className="space-y-1 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 text-[11px]">
                          {order.items.map((it) => {
                            const received = it.receivedQuantity || 0;
                            const isItemFulfilled = received >= it.quantityToOrder;
                            return (
                              <div key={it.itemId} className="flex items-center justify-between text-slate-300 gap-1">
                                <span className="truncate max-w-[170px]" title={it.itemName}>
                                  {it.itemName}
                                </span>
                                <span className="font-mono font-medium text-slate-400 shrink-0">
                                  {received > 0 ? (
                                    <span className={isItemFulfilled ? 'text-emerald-400' : 'text-amber-400'}>
                                      {formatQuantity(received, it.unit)} / {formatQuantity(it.quantityToOrder, it.unit)}
                                    </span>
                                  ) : (
                                    <span>{formatQuantity(it.quantityToOrder, it.unit)}</span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Total Previsto:</span>
                          <span className="text-xs font-bold font-mono text-emerald-400">
                            {formatCurrency(order.totalValue)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setPrintingOrder(order);
                              setIsPrintModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                            title="Visualizar e imprimir espelho do pedido em PDF"
                          >
                            <Printer className="w-3.5 h-3.5 text-amber-400" />
                          </button>
                          {matchingDemo && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrderId(order.id);
                                handleLoadDemo(matchingDemo.key);
                              }}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
                              title="Carregar nota fiscal de demonstração correspondente a este fornecedor para fechar o pedido total ou parcialmente"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Simular com NF-e</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderId(isSelected ? null : order.id);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                            }`}
                            title="Vincular a este pedido de compra ao ler a nota fiscal"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>{isSelected ? 'Selecionado' : 'Vincular'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Method Selector Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => {
                setInputMethod('chave');
                stopCamera();
              }}
              className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
                inputMethod === 'chave'
                  ? 'bg-slate-900 border-amber-500/80 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/50'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    inputMethod === 'chave' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">Digitar / Colar Chave</h4>
                  <p className="text-[11px] text-slate-400">Chave de 44 dígitos da NF-e</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setInputMethod('qrcode');
                startCamera();
              }}
              className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
                inputMethod === 'qrcode'
                  ? 'bg-slate-900 border-amber-500/80 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/50'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    inputMethod === 'qrcode' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">Ler QR Code</h4>
                  <p className="text-[11px] text-slate-400">Câmera, foto ou link da DANFE</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setInputMethod('xml');
                stopCamera();
              }}
              className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
                inputMethod === 'xml'
                  ? 'bg-slate-900 border-amber-500/80 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/50'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    inputMethod === 'xml' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">Carregar Arquivo XML</h4>
                  <p className="text-[11px] text-slate-400">Arquivo .xml oficial da SEFAZ</p>
                </div>
              </div>
            </button>
          </div>

          {/* METHOD 1: DIGITAR OU COLAR CHAVE */}
          {inputMethod === 'chave' && (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Chave de Acesso da NF-e (44 Caracteres)</span>
                  </label>
                  <span className="text-xs font-mono font-medium text-slate-400">
                    {cleanAccessKey(typedKey).length} / 44 caracteres
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={typedKey}
                    onChange={(e) => {
                      setTypedKey(formatAccessKey(cleanAccessKey(e.target.value)));
                      setKeyError(null);
                    }}
                    placeholder="Ex: 3526 0912 3456 7800 0190 5500 1000 1428 5710 9876 5432"
                    className="w-full pl-4 pr-24 py-3.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 font-mono text-sm sm:text-base tracking-wider placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                  <div className="absolute right-2 top-2 bottom-2 flex items-center gap-1.5">
                    {typedKey && (
                      <button
                        type="button"
                        onClick={() => setTypedKey('')}
                        className="p-1.5 text-slate-400 hover:text-slate-200"
                        title="Limpar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const clipboardText = await navigator.clipboard.readText();
                          const key = extractAccessKey(clipboardText);
                          if (key) {
                            setTypedKey(formatAccessKey(key));
                          } else {
                            setTypedKey(clipboardText);
                          }
                        } catch {
                          // Clipboard permission fallback
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-1"
                      title="Colar da área de transferência"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Colar</span>
                    </button>
                  </div>
                </div>

                {keyError && (
                  <p className="text-xs text-rose-400 flex items-center gap-1 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{keyError}</span>
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <p className="text-xs text-slate-400">
                  A chave de acesso é impressa logo abaixo do código de barras da DANFE ou no cabeçalho do Documento Auxiliar.
                </p>

                <button
                  type="button"
                  disabled={cleanAccessKey(typedKey).length !== 44 || isProcessing}
                  onClick={() => processAccessKey(typedKey, 'chave')}
                  className={`px-6 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                    cleanAccessKey(typedKey).length === 44 && !isProcessing
                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/20 active:scale-95'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Consultando dados da NF-e...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Consultar & Pré-Importar Produtos</span>
                    </>
                  )}
                </button>
              </div>

              {/* 1-Click Demo Invoices */}
              <div className="pt-6 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Notas de Demonstração para Teste com 1 Clique</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Clique em qualquer nota para testar a leitura imediata</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {DEMO_INVOICES.map((demo, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleLoadDemo(demo.key)}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/80 transition-all text-left group space-y-2 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                          {demo.title}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          {demo.categoryTag}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {demo.description}
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                        <span className="text-amber-400/90 font-mono">Chave: ...{demo.key.slice(-8)}</span>
                        <span className="text-amber-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                          <span>Testar Nota</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* METHOD 2: LER QR CODE */}
          {inputMethod === 'qrcode' && (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
              {/* QR Mode Selector */}
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4">
                <button
                  type="button"
                  onClick={() => {
                    setQrMode('camera');
                    startCamera();
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    qrMode === 'camera'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Câmera / Webcam</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQrMode('upload');
                    stopCamera();
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    qrMode === 'upload'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Carregar Foto do QR Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQrMode('link');
                    stopCamera();
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    qrMode === 'link'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Colar URL do QR Code (Leitor USB)</span>
                </button>
              </div>

              {cameraError && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{cameraError}</span>
                </div>
              )}

              {/* Camera Scanner View */}
              {qrMode === 'camera' && (
                <div className="space-y-4">
                  <div className="relative max-w-md mx-auto aspect-square rounded-2xl overflow-hidden bg-slate-950 border-2 border-dashed border-amber-500/40 flex items-center justify-center shadow-2xl">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      autoPlay
                      muted
                      playsInline
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Scanner Framing Overlay */}
                    {isCameraActive && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-64 h-64 border-2 border-amber-400/90 rounded-2xl relative shadow-lg">
                          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />
                          {/* Animated Scan Line */}
                          <div className="w-full h-0.5 bg-amber-400/80 shadow-md shadow-amber-400 animate-pulse absolute top-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                    )}

                    {!isCameraActive && (
                      <div className="p-6 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 text-amber-400 flex items-center justify-center mx-auto">
                          <Camera className="w-6 h-6" />
                        </div>
                        <p className="text-xs text-slate-400 max-w-xs">
                          Aponte a câmera para o QR Code impresso na sua DANFE ou cupom fiscal.
                        </p>
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all shadow-md"
                        >
                          Ligar Câmera
                        </button>
                      </div>
                    )}
                  </div>

                  {isCameraActive && (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700"
                      >
                        Pausar Câmera
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Upload QR Code Photo */}
              {qrMode === 'upload' && (
                <div className="max-w-md mx-auto space-y-4 text-center">
                  <label className="block p-8 rounded-2xl border-2 border-dashed border-slate-700 hover:border-amber-500/70 bg-slate-950/60 cursor-pointer transition-all space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 text-amber-400 flex items-center justify-center mx-auto">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">Selecionar Foto do QR Code</h4>
                      <p className="text-xs text-slate-400 pt-1">
                        Tire uma foto nítida do QR Code da DANFE ou anexe um arquivo PNG / JPG
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleQrImageUpload(file);
                      }}
                    />
                  </label>
                </div>
              )}

              {/* Paste QR Link */}
              {qrMode === 'link' && (
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-300 block">
                    URL decodificada pelo leitor óptico / QR Code da SEFAZ
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={qrLinkInput}
                      onChange={(e) => setQrLinkInput(e.target.value)}
                      placeholder="Ex: https://www.sefaz.sp.gov.br/nfce/qrcode?p=35260900000000000001550010001428571098765432|2|1|1|..."
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      disabled={!qrLinkInput.trim()}
                      onClick={() => handleQrCodeScanned(qrLinkInput)}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all disabled:opacity-50"
                    >
                      Processar Link
                    </button>
                  </div>
                </div>
              )}

              {/* Demo button shortcut */}
              <div className="pt-4 border-t border-slate-800 text-center">
                <span className="text-xs text-slate-400">
                  Sem leitor ou DANFE em mãos no momento?{' '}
                  <button
                    type="button"
                    onClick={() => handleLoadDemo(DEMO_INVOICES[0].key)}
                    className="text-amber-400 hover:text-amber-300 font-bold underline"
                  >
                    Clique aqui para simular a leitura do QR Code com uma nota de teste
                  </button>
                </span>
              </div>
            </div>
          )}

          {/* METHOD 3: UPLOAD DE ARQUIVO XML */}
          {inputMethod === 'xml' && (
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleXmlFile(file);
                }}
                className={`p-10 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer ${
                  dragOver
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-slate-700 hover:border-amber-500/50 bg-slate-950/60'
                }`}
              >
                <label className="cursor-pointer space-y-3 block">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 text-amber-400 flex items-center justify-center mx-auto shadow-md">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-100">
                      Arraste ou selecione o arquivo XML da NF-e
                    </h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto pt-1">
                      Compatível com o layout padrão brasileiro da SEFAZ (tags &lt;nfeProc&gt;, &lt;NFe&gt;, &lt;det&gt;, &lt;prod&gt;).
                    </p>
                  </div>
                  <div className="pt-2">
                    <span className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all inline-block shadow-md">
                      Buscar arquivo no computador
                    </span>
                  </div>
                  <input
                    type="file"
                    accept=".xml,text/xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleXmlFile(file);
                    }}
                  />
                </label>
              </div>

              {xmlFileName && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Arquivo carregado: <strong>{xmlFileName}</strong></span>
                  </span>
                  {isProcessing && <span className="text-amber-400 font-semibold">Processando dados...</span>}
                </div>
              )}

              {xmlError && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{xmlError}</span>
                </div>
              )}

              {/* Shortcut test */}
              <div className="pt-4 border-t border-slate-800 text-center">
                <span className="text-xs text-slate-400">
                  Não possui um arquivo XML local?{' '}
                  <button
                    type="button"
                    onClick={() => handleLoadDemo(DEMO_INVOICES[0].key)}
                    className="text-amber-400 hover:text-amber-300 font-bold underline"
                  >
                    Carregar XML de exemplo de distribuidora de alimentos
                  </button>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TELA DE PRÉ-IMPORTAÇÃO & CONFERÊNCIA DE COMPATIBILIDADE */}
      {activeTab === 'importar' && activeInvoice && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Supplier Registration / Link Feedback Alert */}
          {supplierRegistrationFeedback && (
            <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-3 shadow-lg animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="font-semibold">{supplierRegistrationFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setSupplierRegistrationFeedback(null)}
                className="p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Header Summary of Invoice */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full">
                    NF-e nº {activeInvoice.number}
                  </span>
                  <span className="text-xs text-slate-400">
                    Série {activeInvoice.series} • Emissão: {new Date(activeInvoice.issueDate).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    Lida via {activeInvoice.sourceType.toUpperCase()}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-400" />
                  <span>{activeInvoice.supplierName}</span>
                </h3>

                <p className="text-xs text-slate-400 flex items-center gap-3">
                  <span>CNPJ: <strong className="text-slate-300">{activeInvoice.supplierCnpj}</strong></span>
                  {isSupplierRegistered ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Fornecedor homologado no sistema
                    </span>
                  ) : (
                    <span className="text-amber-400 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Fornecedor não cadastrado (requer validação CNPJ)
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 block">Total da Nota Fiscal</span>
                  <span className="text-xl font-black text-emerald-400">
                    {formatCurrency(activeInvoice.totalInvoiceValue)}
                  </span>
                </div>
                <div className="h-8 w-px bg-slate-800" />
                <div>
                  <span className="text-[11px] font-medium text-slate-400 block">Itens na Nota</span>
                  <span className="text-xl font-bold text-slate-100">
                    {activeInvoice.items.length} itens
                  </span>
                </div>
              </div>
            </div>

            {/* SUPPLIER STATUS & REGISTRATION WORKFLOW CARD */}
            {isSupplierRegistered ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-300">
                        Fornecedor Cadastrado no Sistema
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        CNPJ Validado
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-100 mt-0.5">
                      {matchedSupplier?.name || activeInvoice.supplierName}
                    </p>
                    <p className="text-xs text-slate-400">
                      CNPJ: <strong className="text-slate-300">{activeInvoice.supplierCnpj}</strong> • Categoria: {matchedSupplier?.category || 'Geral'} • Produtos vinculados: {activeInvoice.items.length} itens
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-emerald-400 font-semibold bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-800/50 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    <span>Produtos vinculados</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsRegisterSupplierModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-700 transition-all border border-slate-700"
                  >
                    Alterar Vínculo
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 space-y-3 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                          Fornecedor Não Cadastrado no Sistema
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Validação Necessária
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-100 mt-0.5">
                        {activeInvoice.supplierName}
                      </p>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                        Buscamos pelo CNPJ <strong className="text-amber-200">{activeInvoice.supplierCnpj}</strong> na base de fornecedores e nenhum cadastro foi encontrado. Cadastre com validação do CNPJ para vincular os {activeInvoice.items.length} produtos desta nota fiscal.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center">
                    <button
                      type="button"
                      onClick={() => setIsRegisterSupplierModalOpen(true)}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Cadastrar Fornecedor (Validar CNPJ)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsRegisterSupplierModalOpen(true)}
                      className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-700 transition-all border border-slate-700 flex items-center gap-1.5"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Vincular a Existente</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Access key banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
              <div className="flex items-center gap-2 truncate">
                <span className="font-semibold text-slate-300">Chave de Acesso:</span>
                <span className="font-mono text-[11px] text-amber-400/90 bg-slate-950 px-2.5 py-1 rounded border border-slate-800 truncate">
                  {formatAccessKey(activeInvoice.accessKey)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-slate-400 hover:text-slate-200 underline font-medium self-start sm:self-auto"
              >
                Ler outra nota fiscal
              </button>
            </div>
          </div>

          {/* VÍNCULO COM PEDIDO DE COMPRA & FECHAMENTO DE ENTREGA */}
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>Vincular a Pedido de Compra</span>
                    {selectedOrderId && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Vínculo Ativo
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-400">
                    Cruze os itens da NF-e com o pedido de compra para conciliar a entrega e fechar o pedido total ou parcialmente de acordo com as quantidades.
                  </p>
                </div>
              </div>

              {/* Dropdown Selector */}
              <div className="w-full sm:w-auto">
                <select
                  value={selectedOrderId || ''}
                  onChange={(e) => setSelectedOrderId(e.target.value || null)}
                  className="w-full sm:w-80 py-2.5 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="">Nenhum (Entrada avulsa / sem pedido prévio)</option>
                  {openPurchaseOrders.map((ord) => {
                    const isMatch = matchingOpenOrdersForSupplier.some((m) => m.id === ord.id);
                    return (
                      <option key={ord.id} value={ord.id}>
                        {ord.orderNumber || ord.id} — {ord.supplierName} ({formatCurrency(ord.totalValue)}) {isMatch ? '★ [Fornecedor da Nota]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* PAINEL DE CONCILIAÇÃO & RESULTADO DO FECHAMENTO */}
            {linkedOrderAnalysis ? (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Header de Identificação e Impressão do Pedido */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-200">
                      Pedido em Conferência: <strong className="text-amber-400 font-mono">{linkedOrderAnalysis.linkedOrder.orderNumber || linkedOrderAnalysis.linkedOrder.id}</strong> ({linkedOrderAnalysis.linkedOrder.supplierName})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPrintingOrder(linkedOrderAnalysis.linkedOrder);
                      setIsPrintModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0 self-start sm:self-auto"
                    title="Imprimir espelho do pedido em formato simplificado para PDF"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Imprimir Pedido / PDF</span>
                  </button>
                </div>

                {/* Banner de Fechamento Total ou Parcial */}
                {linkedOrderAnalysis.allItemsFulfilled ? (
                  <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-start gap-3 shadow-md">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-200">
                          Fechamento Total do Pedido
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-100 font-bold border border-emerald-500/40">
                          100% Entregue
                        </span>
                      </div>
                      <p className="text-xs text-emerald-200/90 leading-relaxed">
                        Todos os itens pedidos em <strong>{linkedOrderAnalysis.linkedOrder.orderNumber || linkedOrderAnalysis.linkedOrder.id}</strong> ({linkedOrderAnalysis.linkedOrder.supplierName}) serão atendidos com as quantidades desta nota fiscal. Ao clicar em <strong>"Confirmar Entrada no Estoque"</strong>, o pedido será automaticamente finalizado com status <strong>'Entregue / Fechado'</strong>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 flex items-start gap-3 shadow-md">
                    <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-amber-200">
                          Fechamento Parcial do Pedido
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-100 font-bold border border-amber-500/40">
                          Entrega Parcial
                        </span>
                      </div>
                      <p className="text-xs text-amber-200/90 leading-relaxed">
                        Esta nota fiscal atende parte do pedido <strong>{linkedOrderAnalysis.linkedOrder.orderNumber || linkedOrderAnalysis.linkedOrder.id}</strong>. Os itens ou quantidades restantes continuarão pendentes de entrega e o pedido será atualizado para o status <strong>'Parcialmente Entregue'</strong>, permanecendo aberto para próximas notas fiscais.
                      </p>
                    </div>
                  </div>
                )}

                {/* Tabela de Conciliação Linha a Linha */}
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900 text-slate-400">
                        <th className="py-2.5 px-3 font-semibold">Item do Pedido</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Qtd Pedida</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Já Entregue</th>
                        <th className="py-2.5 px-3 font-semibold text-right text-amber-400">Nesta NF-e</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Saldo Restante</th>
                        <th className="py-2.5 px-3 font-semibold text-center">Status de Entrega</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {linkedOrderAnalysis.itemReconciliation.map((rec) => (
                        <tr key={rec.orderItem.itemId} className="hover:bg-slate-900/60 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-slate-200">
                            <div>{rec.orderItem.itemName}</div>
                            {rec.matchingInvItem && (
                              <span className="text-[10px] text-slate-500 truncate max-w-xs block">
                                Item na NF: {rec.matchingInvItem.name}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            {formatQuantity(rec.orderItem.quantityToOrder, rec.orderItem.unit)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                            {formatQuantity(rec.previouslyReceived, rec.orderItem.unit)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">
                            {rec.quantityInThisInvoice > 0
                              ? `+${formatQuantity(rec.quantityInThisInvoice, rec.orderItem.unit)}`
                              : '0'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {rec.remainingAfterThisInvoice === 0 ? (
                              <span className="text-emerald-400">0 {rec.orderItem.unit}</span>
                            ) : (
                              <span className="text-amber-400">
                                {formatQuantity(rec.remainingAfterThisInvoice, rec.orderItem.unit)}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {rec.itemStatus === 'total' || rec.itemStatus === 'excesso' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <Check className="w-3 h-3" />
                                <span>Atendido Total</span>
                              </span>
                            ) : rec.itemStatus === 'parcial' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                <Clock className="w-3 h-3" />
                                <span>Parcial</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                <X className="w-3 h-3" />
                                <span>Não Entregue</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {linkedOrderAnalysis.extraItemsInInvoice.length > 0 && (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                    <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      Esta nota fiscal contém <strong>{linkedOrderAnalysis.extraItemsInInvoice.length} item(ns) adicional(is)</strong> que não constavam no pedido de compra inicial (serão adicionados normalmente ao estoque).
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                {openPurchaseOrders.length > 0
                  ? 'Selecione um dos pedidos de compra em aberto acima para conferir o atendimento e fechar o pedido de acordo com esta nota fiscal.'
                  : 'Nenhum pedido de compra em aberto encontrado para vinculação.'}
              </p>
            )}
          </div>

          {/* SECTION: PRODUTOS COMPATÍVEIS COM O ESTOQUE */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-400" />
                  <span>Conferência de Produtos da Nota Fiscal x Estoque Atual</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Verifique a correspondência dos itens, ajuste fatores de conversão de embalagem e veja o impacto projetado nos estoques e custos.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {matchedCount} compatível(is)
                </span>
                {newItemsCount > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20">
                    {newItemsCount} novo(s) para cadastrar
                  </span>
                )}
              </div>
            </div>

            {/* List of invoice items with live stock matching */}
            <div className="space-y-3">
              {activeInvoice.items.map((invItem) => {
                const targetStock = items.find((it) => it.id === invItem.matchedStockItemId);
                const addedQuantity = invItem.quantity * (invItem.conversionFactor || 1);
                const currentStock = targetStock ? targetStock.currentStock : 0;
                const newStockProjected = currentStock + addedQuantity;

                // Price variance calculation
                const unitCostOnInvoice = invItem.unitPrice / (invItem.conversionFactor || 1);
                const currentCost = targetStock ? targetStock.costPrice : unitCostOnInvoice;
                const priceDiff = unitCostOnInvoice - currentCost;
                const priceDiffPct = currentCost > 0 ? (priceDiff / currentCost) * 100 : 0;

                const isExpanded = expandedItemId === invItem.id;

                return (
                  <div
                    key={invItem.id}
                    className={`p-4 rounded-xl border transition-all space-y-3 ${
                      !invItem.applied
                        ? 'bg-slate-950/40 border-slate-850 opacity-60'
                        : targetStock
                        ? 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950 border-sky-500/30'
                    }`}
                  >
                    {/* Item Header Row */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      {/* Selection checkbox and name */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          id={`check-item-${invItem.id}`}
                          checked={invItem.applied}
                          onChange={() => handleToggleItemApplied(invItem.id)}
                          className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-950 cursor-pointer"
                        />

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              {invItem.itemCode || 'S/ COD'}
                            </span>
                            <h4 className="text-sm font-extrabold text-slate-100 truncate">
                              {invItem.name}
                            </h4>
                            {invItem.ncm && (
                              <span className="text-[10px] text-slate-500">NCM {invItem.ncm}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span>
                              Qtd faturada: <strong className="text-slate-200">{invItem.quantity} {invItem.unit}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Preço unitário: <strong className="text-slate-200">{formatCurrency(invItem.unitPrice)}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              Total: <strong className="text-emerald-400">{formatCurrency(invItem.totalPrice)}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-1 text-[11px]">
                            <span className="text-slate-500">Fornecedor vinculado:</span>
                            {isSupplierRegistered ? (
                              <span className="text-emerald-300 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>{matchedSupplier?.name || activeInvoice.supplierName}</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setIsRegisterSupplierModalOpen(true)}
                                className="text-amber-300 hover:text-amber-200 font-medium flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/20 transition-colors"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                <span>Fornecedor não cadastrado • Clique para cadastrar e vincular produtos</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Matching Status Pill & Projection Quick Stats */}
                      <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
                        {targetStock ? (
                          <div className="flex items-center gap-3 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-500 block">Estoque Atual</span>
                              <span className="font-bold text-slate-300">
                                {formatQuantity(currentStock, targetStock.unit)}
                              </span>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                            <div>
                              <span className="text-[10px] text-amber-400/90 font-bold block">Novo Estoque</span>
                              <span className="font-extrabold text-emerald-400">
                                {formatQuantity(newStockProjected, targetStock.unit)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>Novo Item no Estoque</span>
                          </span>
                        )}

                        {/* Price Variance Badge */}
                        {targetStock && (
                          <div
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border ${
                              priceDiff > 0.05
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                : priceDiff < -0.05
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-900 text-slate-400 border-slate-800'
                            }`}
                            title={`Custo anterior: ${formatCurrency(targetStock.costPrice)} | Custo na nota: ${formatCurrency(unitCostOnInvoice)}`}
                          >
                            {priceDiff > 0.05 ? (
                              <>
                                <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                                <span>+{priceDiffPct.toFixed(1)}% (Custo Subiu)</span>
                              </>
                            ) : priceDiff < -0.05 ? (
                              <>
                                <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                                <span>{priceDiffPct.toFixed(1)}% (Economia)</span>
                              </>
                            ) : (
                              <span>Custo Estável</span>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setExpandedItemId(isExpanded ? null : invItem.id)}
                          className="p-1.5 rounded-lg bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                          title="Ajustar vínculo ou unidade"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable configuration section for unit conversion, item matching, or new item category */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-900/50 p-3 rounded-xl">
                        {/* 1. Item matching selector */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-400 block">
                            Vínculo no Estoque do Restaurante:
                          </label>
                          <select
                            value={invItem.matchedStockItemId || ''}
                            onChange={(e) => handleUpdateItemStockMatch(invItem.id, e.target.value)}
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                          >
                            <option value="">➕ Criar como NOVO ITEM no catálogo</option>
                            <optgroup label="Itens já cadastrados no estoque:">
                              {items.map((stk) => (
                                <option key={stk.id} value={stk.id}>
                                  {stk.name} ({stk.unit}) - Atual: {stk.currentStock} {stk.unit}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>

                        {/* 2. Unit conversion factor */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                            <span>Fator de Conversão de Embalagem:</span>
                            <span className="text-amber-400 font-bold">
                              1 {invItem.unit} = {invItem.conversionFactor || 1} {targetStock?.unit || invItem.targetStockUnit || 'un'}
                            </span>
                          </label>
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={invItem.conversionFactor || 1}
                            onChange={(e) => handleUpdateConversionFactor(invItem.id, parseFloat(e.target.value) || 1)}
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                          />
                          <p className="text-[10px] text-slate-500">
                            Ex: se a nota faturou em Caixa (CX) com 12 unidades, informe 12.
                          </p>
                        </div>

                        {/* 3. Lote e Validade */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-400 block">
                            Validade do Lote Recebido ({invItem.batchNumber || 'Lote Padrão'}):
                          </label>
                          <input
                            type="date"
                            value={invItem.expiryDate || ''}
                            onChange={(e) => handleUpdateExpiryDate(invItem.id, e.target.value)}
                            className="w-full px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        {/* If New Item, Category selector */}
                        {!invItem.matchedStockItemId && (
                          <div className="space-y-1 md:col-span-3 pt-2 border-t border-slate-800">
                            <label className="text-[11px] font-semibold text-sky-300 block">
                              Categoria para o Novo Item Cadastrado:
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {(['porcionamento', 'petisco', 'consumo', 'bebida', 'limpeza', 'outro'] as ItemCategory[]).map((cat) => (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => handleUpdateNewItemCategory(invItem.id, cat)}
                                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all border ${
                                    invItem.newItemCategory === cat
                                      ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                                      : 'bg-slate-950 text-slate-400 border-slate-700 hover:border-slate-600'
                                  }`}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Action Card & Confirmation */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400">Resumo da Entrada Selecionada:</span>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-bold text-slate-200">
                    {appliedCount} de {activeInvoice.items.length} itens marcados
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-sm font-bold text-emerald-400">
                    Valor faturado: {formatCurrency(totalAppliedValue)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={appliedCount === 0}
                  onClick={handleConfirmImport}
                  className={`px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-lg ${
                    appliedCount > 0
                      ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20 active:scale-95'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmar Entrada no Estoque ({appliedCount})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CADASTRO DE FORNECEDOR COM VALIDAÇÃO DE CNPJ E VÍNCULO DE PRODUTOS */}
      {activeInvoice && (
        <RegisterSupplierFromInvoiceModal
          isOpen={isRegisterSupplierModalOpen}
          onClose={() => setIsRegisterSupplierModalOpen(false)}
          invoice={activeInvoice}
          existingSuppliers={allSuppliers}
          onSupplierRegistered={handleSupplierRegistered}
          onSelectExistingSupplier={handleSelectExistingSupplier}
        />
      )}

      {/* MODAL DE IMPRESSÃO / PDF SIMPLIFICADO DO PEDIDO */}
      <PrintOrderModal
        order={printingOrder}
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setPrintingOrder(null);
        }}
        companyName="Desenvolvimento de Software"
        supplier={allSuppliers.find((s) => s.id === printingOrder?.supplierId)}
      />
    </div>
  );
};
