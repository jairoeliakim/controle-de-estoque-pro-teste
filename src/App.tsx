import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './context/ThemeContext';
import {
  INITIAL_ITEMS,
  INITIAL_SUPPLIERS,
  INITIAL_LOSSES,
  INITIAL_MONTHLY_PERFORMANCE,
  INITIAL_COUNT_SESSIONS,
  INITIAL_ORDERS,
  INITIAL_SYSTEM_SETTINGS,
  INITIAL_DEMO_USERS,
  INITIAL_COMPANIES,
  INITIAL_EMPLOYEES,
} from './data/initialData';
import { syncEntityToDatabase, deleteEntityFromDatabase, fetchAllDatabaseData } from './utils/databaseSync';
import { hashPassword } from './utils/passwordSecurity';
import {
  CountDay,
  CountScheduleConfig,
  InvoiceData,
  LossRecord,
  MonthlyPerformance,
  PurchaseOrder,
  StockCountSession,
  StockItem,
  SupervisorAuthorization,
  Supplier,
  UserRole,
  Company,
  Employee,
  UnlistedCountItem,
  ItemCategory,
  canAccessBilling,
  canAccessApiAndDatabase,
  canBlockOrDeleteGerente,
  SystemSettings,
  AuthUser,
  canAccessSystemSettings,
  isTabAllowedForRole,
} from './types';
import { Header } from './components/Header';
import { Navigation, ActiveTab } from './components/Navigation';
import { AccessDeniedView } from './components/AccessDeniedView';
import { GeneralStockView } from './components/GeneralStockView';
import { EmployeeCountView } from './components/EmployeeCountView';
import { BuyerRestockView } from './components/BuyerRestockView';
import { BudgetQuotesView } from './components/BudgetQuotesView';
import { InvoiceImporterView } from './components/InvoiceImporterView';
import { LossesView } from './components/LossesView';
import { DashboardView } from './components/DashboardView';
import { ItemsCatalogView } from './components/ItemsCatalogView';
import { LossRegisterModal } from './components/LossRegisterModal';
import { ItemModal } from './components/ItemModal';
import { SuppliersModal } from './components/SuppliersModal';
import { CountScheduleModal } from './components/CountScheduleModal';
import { SupervisorReleaseModal } from './components/SupervisorReleaseModal';
import { CompanyManagementModal } from './components/CompanyManagementModal';
import { EmployeesManagementModal } from './components/EmployeesManagementModal';
import { RecordUnlistedItemModal } from './components/RecordUnlistedItemModal';
import { UnlistedItemsApprovalModal } from './components/UnlistedItemsApprovalModal';
import { SystemSettingsModal } from './components/SystemSettingsModal';
import { InitialSetupWizardModal } from './components/InitialSetupWizardModal';
import { LoginView } from './components/LoginView';
import { BillingGracePeriodBanner } from './components/billing/BillingGracePeriodBanner';
import { BillingOverduePaywall } from './components/billing/BillingOverduePaywall';
import { BillingModal } from './components/billing/BillingModal';
import { BillingSimulationDrawer } from './components/billing/BillingSimulationDrawer';
import { OnlineInventoryApiWorkbench } from './components/inventory/OnlineInventoryApiWorkbench';
import { getStockHealth } from './utils/formatters';
import { cleanCNPJ } from './utils/cnpjValidator';

// Limpeza única e definitiva de dados legados de depuração salvos em versões anteriores no navegador
const CLEAN_DEBUG_KEY = 'ce_v2_clean_debug_2026';
if (typeof window !== 'undefined' && !localStorage.getItem(CLEAN_DEBUG_KEY)) {
  localStorage.removeItem('ce_items');
  localStorage.removeItem('ce_suppliers');
  localStorage.removeItem('ce_losses');
  localStorage.removeItem('ce_sessions');
  localStorage.removeItem('ce_orders');
  localStorage.removeItem('ce_employees');
  localStorage.removeItem('ce_unlisted_items');
  localStorage.setItem(CLEAN_DEBUG_KEY, 'true');
}

export default function App() {
  const { theme, toggleTheme } = useTheme();

  // Role State (default: conferente or administrador)
  const [currentRole, setCurrentRole] = useState<UserRole>('administrador');

  // Active View Tab (Default: Contagem se conferente, caso contrário Estoque)
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    try {
      const savedUserStr = localStorage.getItem('ce_auth_user');
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr);
        if (u.role === 'conferente') return 'contagem';
      }
    } catch {}
    return 'estoque';
  });

  // Core Data loaded from localStorage or defaults
  const [items, setItems] = useState<StockItem[]>(() => {
    const saved = localStorage.getItem('ce_items');
    return saved ? JSON.parse(saved) : INITIAL_ITEMS;
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem('ce_suppliers');
    return saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
  });

  const [losses, setLosses] = useState<LossRecord[]>(() => {
    const saved = localStorage.getItem('ce_losses');
    return saved ? JSON.parse(saved) : INITIAL_LOSSES;
  });

  const [countSessions, setCountSessions] = useState<StockCountSession[]>(() => {
    const saved = localStorage.getItem('ce_sessions');
    return saved ? JSON.parse(saved) : INITIAL_COUNT_SESSIONS;
  });

  const [ordersHistory, setOrdersHistory] = useState<PurchaseOrder[]>(() => {
    const saved = localStorage.getItem('ce_orders');
    return saved ? JSON.parse(saved) : INITIAL_ORDERS;
  });

  const [importedInvoices, setImportedInvoices] = useState<InvoiceData[]>(() => {
    const saved = localStorage.getItem('ce_imported_invoices');
    return saved ? JSON.parse(saved) : [];
  });

  const [countSchedule, setCountSchedule] = useState<CountScheduleConfig>(() => {
    const saved = localStorage.getItem('ce_count_schedule');
    return saved
      ? JSON.parse(saved)
      : {
          defaultDays: ['quarta', 'domingo'],
          updatedAt: new Date().toISOString(),
          updatedBy: 'Gerência Operacional',
          notes: 'Contagens oficiais pré-estabelecidas',
        };
  });

  const [supervisorAuthorization, setSupervisorAuthorization] = useState<SupervisorAuthorization | null>(null);

  const [monthlyMetrics, setMonthlyMetrics] = useState<MonthlyPerformance[]>(INITIAL_MONTHLY_PERFORMANCE);

  // Multi-Empresa / Multi-Tenant State
  const [companies, setCompanies] = useState<Company[]>(() => {
    const saved = localStorage.getItem('ce_companies');
    return saved ? JSON.parse(saved) : INITIAL_COMPANIES;
  });

  const [activeCompanyId, setActiveCompanyId] = useState<string>(() => {
    const saved = localStorage.getItem('ce_active_company_id');
    if (saved === 'comp-matriz' || saved === 'emp-matriz') return '00000000000001';
    return saved || '00000000000001';
  });

  // Funcionários por Empresa
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('ce_employees');
    return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
  });

  // Itens Não Cadastrados Anotados pelo Conferente (Aguardando Aprovação de Compras / Gerente)
  const [unlistedItems, setUnlistedItems] = useState<UnlistedCountItem[]>(() => {
    const saved = localStorage.getItem('ce_unlisted_items');
    return saved ? JSON.parse(saved) : [];
  });

  // Modals state
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [isSuppliersModalOpen, setIsSuppliersModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [isApiWorkbenchOpen, setIsApiWorkbenchOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isEmployeesModalOpen, setIsEmployeesModalOpen] = useState(false);
  const [isRecordUnlistedOpen, setIsRecordUnlistedOpen] = useState(false);
  const [isUnlistedApprovalOpen, setIsUnlistedApprovalOpen] = useState(false);
  const [preselectedOrderIdForInvoice, setPreselectedOrderIdForInvoice] = useState<string | null>(null);
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState(false);
  const [isInitialSetupWizardOpen, setIsInitialSetupWizardOpen] = useState(false);
  const [systemSettingsTab, setSystemSettingsTab] = useState<'precos' | 'contagem' | 'seguranca' | 'financeiro' | 'database'>('precos');

  // Parametrização Sistêmica & Governança (Exclusivo Administrador)
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    const saved = localStorage.getItem('ce_system_settings');
    return saved ? JSON.parse(saved) : INITIAL_SYSTEM_SETTINGS;
  });

  // Base de Acessos Individuais Cadastrados
  const [registeredUsers, setRegisteredUsers] = useState<AuthUser[]>(() => {
    const saved = localStorage.getItem('ce_users');
    return saved ? JSON.parse(saved) : INITIAL_DEMO_USERS;
  });

  // Usuário Autenticado Ativo (Acesso Individual)
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('ce_auth_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('ce_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('ce_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('ce_losses', JSON.stringify(losses));
  }, [losses]);

  useEffect(() => {
    localStorage.setItem('ce_sessions', JSON.stringify(countSessions));
  }, [countSessions]);

  useEffect(() => {
    localStorage.setItem('ce_orders', JSON.stringify(ordersHistory));
  }, [ordersHistory]);

  useEffect(() => {
    localStorage.setItem('ce_imported_invoices', JSON.stringify(importedInvoices));
  }, [importedInvoices]);

  useEffect(() => {
    localStorage.setItem('ce_count_schedule', JSON.stringify(countSchedule));
  }, [countSchedule]);

  useEffect(() => {
    localStorage.setItem('ce_system_settings', JSON.stringify(systemSettings));
  }, [systemSettings]);

  useEffect(() => {
    localStorage.setItem('ce_users', JSON.stringify(registeredUsers));
  }, [registeredUsers]);

  useEffect(() => {
    if (authUser) {
      localStorage.setItem('ce_auth_user', JSON.stringify(authUser));
    } else {
      localStorage.removeItem('ce_auth_user');
    }
  }, [authUser]);

  useEffect(() => {
    localStorage.setItem('ce_companies', JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    localStorage.setItem('ce_active_company_id', activeCompanyId);
  }, [activeCompanyId]);

  useEffect(() => {
    localStorage.setItem('ce_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('ce_unlisted_items', JSON.stringify(unlistedItems));
  }, [unlistedItems]);

  // Carregamento inicial a partir do banco de dados relacional
  useEffect(() => {
    fetchAllDatabaseData().then((dbData) => {
      if (dbData && dbData.tables) {
        // 1. Produtos / Estoque (Carregados do SGBD)
        if (Array.isArray(dbData.tables.stock_items) && dbData.tables.stock_items.length > 0) {
          const mappedItems: StockItem[] = dbData.tables.stock_items.map((it: any) => ({
            id: it.id,
            name: it.name,
            code: it.barcode || it.code || `ITM-${it.id.substring(0, 4)}`,
            category: it.category || 'outro',
            unit: it.unit || 'un',
            currentStock: Number(it.current_stock ?? it.currentStock ?? 0),
            minStock: Number(it.min_stock ?? it.minStock ?? 0),
            reorderPoint: Number(it.reorder_point ?? it.reorderPoint ?? (it.min_stock ? Number(it.min_stock) * 1.3 : 0)),
            optimalStock: Number(it.ideal_stock ?? it.optimalStock ?? it.idealStock ?? 0),
            costPrice: Number(it.unit_cost ?? it.costPrice ?? 0),
            primarySupplierId: it.primary_supplier_id || it.primarySupplierId,
            countDays: typeof it.count_days === 'string' ? JSON.parse(it.count_days) : (it.countDays || ['quarta', 'domingo']),
            lastCountDate: it.last_count_date || it.lastCountDate,
            currentBatchExpiry: it.current_batch_expiry || it.currentBatchExpiry,
            location: it.location || '',
          }));
          setItems(mappedItems);
        }

        // 2. Fornecedores
        if (Array.isArray(dbData.tables.suppliers) && dbData.tables.suppliers.length > 0) {
          const mappedSuppliers: Supplier[] = dbData.tables.suppliers.map((s: any) => {
            const pais = s.pais_origem || s.paisOrigem || 'BR';
            const docType = s.tipo_documento || s.tipoDocumento || (pais === 'BR' ? 'CNPJ' : 'TAX_ID');
            const docId = s.documento_identificador || s.documentoIdentificador || s.cnpj || undefined;
            return {
              id: s.id,
              name: s.name,
              tradeName: s.trade_name || s.tradeName,
              cnpj: s.cnpj || (pais === 'BR' ? docId : undefined),
              paisOrigem: pais,
              tipoDocumento: docType,
              documentoIdentificador: docId,
              contactName: s.contact_name || s.contactName || 'Comercial',
              phone: s.phone || '',
              email: s.email || '',
              deliveryDays: Number(s.delivery_days ?? s.deliveryDays ?? 1),
              category: s.category || 'Geral',
              minOrderValue: Number(s.min_order_value ?? s.minOrderValue ?? 0),
              notes: s.notes || '',
              createdAt: s.created_at || s.createdAt || new Date().toISOString(),
              priceUpdateIntervalDays: Number(s.price_update_interval_days ?? s.priceUpdateIntervalDays ?? 30),
              lastPriceUpdateDate: s.last_price_update_date || s.lastPriceUpdateDate,
              suppliedProductIds: s.supplied_product_ids || s.suppliedProductIds || [],
            };
          });
          setSuppliers(mappedSuppliers);
        }

        // 3. Usuários e Funcionários
        if (Array.isArray(dbData.tables.system_users) && dbData.tables.system_users.length > 0) {
          const empUsers = dbData.tables.system_users.filter(
            (u: any) => u.role === 'gerente' || u.role === 'compras' || u.role === 'conferente'
          );
          if (empUsers.length > 0) {
            const mappedEmployees: Employee[] = empUsers.map((u: any) => {
              const rawTenant = u.tenant_id || u.companyId || '00000000000001';
              const cleanTenant = rawTenant === 'comp-matriz' || rawTenant === 'emp-matriz' ? '00000000000001' : rawTenant;
              return {
                id: u.id,
                companyId: cleanTenant,
                name: u.name,
                email: u.email,
                phone: u.phone || '',
                role: u.role,
                status: u.is_active === 0 || u.is_active === false || u.status === 'bloqueado' ? 'bloqueado' : 'ativo',
                createdAt: u.created_at || u.createdAt || new Date().toISOString(),
                notes: u.notes,
                lastLogin: u.last_login || u.lastLogin,
              };
            });
            setEmployees((prev) => {
              const map = new Map<string, Employee>();
              prev.forEach((e) => map.set(e.id, e));
              mappedEmployees.forEach((e) => map.set(e.id, e));
              return Array.from(map.values());
            });
          }

          // Acessos autenticados
          const mappedAuthUsers: AuthUser[] = dbData.tables.system_users.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            companyId: u.tenant_id || u.companyId || '00000000000001',
            companyName: 'CEC Conecta',
            avatarUrl: '',
            phone: u.phone,
            pin: u.pin || u.password_hash || '@dm!n2026',
            lastLogin: u.last_login || u.lastLogin,
          }));
          setRegisteredUsers((prev) => {
            const merged = [...prev];
            mappedAuthUsers.forEach((nu) => {
              const idx = merged.findIndex((x) => x.id === nu.id || x.email.toLowerCase() === nu.email.toLowerCase());
              if (idx >= 0) {
                merged[idx] = nu;
              } else {
                merged.push(nu);
              }
            });
            return merged;
          });
        }

        // 4. Empresas (Tenant identificado pelo CNPJ sem traços)
        if (Array.isArray(dbData.tables.tenants_companies) && dbData.tables.tenants_companies.length > 0) {
          const mappedCompanies: Company[] = dbData.tables.tenants_companies.map((c: any) => {
            const cleanCnpj = cleanCNPJ(c.cnpj || '');
            const tenantId = cleanCnpj || (c.id === 'comp-matriz' ? '00000000000001' : c.id);
            return {
              id: tenantId,
              name: c.name,
              tradeName: c.trade_name || c.tradeName || c.name,
              cnpj: c.cnpj || '00.000.000/0000-00',
              paisOrigem: c.pais_origem || c.paisOrigem || 'BR',
              tipoDocumento: c.tipo_documento || c.tipoDocumento || 'CNPJ',
              documentoIdentificador: c.documento_identificador || c.documentoIdentificador || cleanCnpj || '00000000000001',
              city: c.city || '',
              state: c.state || '',
              phone: c.phone || '',
              email: c.email || '',
              segment: c.segment || 'Alimentos e Bebidas',
              active: c.is_active !== 0 && c.is_active !== false && c.active !== false,
              createdAt: c.created_at || c.createdAt || new Date().toISOString(),
            };
          });
          setCompanies(mappedCompanies);
        }
      }
    });
  }, []);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) || companies[0];

  // Auth Handlers (Tela de Login e Acessos Individuais)
  const handleLogin = (user: AuthUser, needsInitialCompanySetup = false) => {
    setAuthUser(user);
    setCurrentRole(user.role);
    if (user.companyId && user.companyId !== '00000000000000') {
      setActiveCompanyId(user.companyId);
    }
    if (user.role === 'administrador') {
      setActiveTab('estoque');
      // Se acessou via CNPJ 00000000000000 ou necessita de setup inicial, abre o assistente de setup e sincronização de banco
      if (needsInitialCompanySetup || user.companyId === '00000000000000') {
        setIsInitialSetupWizardOpen(true);
      }
    } else if (user.role === 'conferente') {
      setActiveTab('contagem');
    } else if (user.role === 'compras') {
      setActiveTab('compras');
    } else if (user.role === 'gerente') {
      setActiveTab('perdas');
    } else {
      setActiveTab('estoque');
    }
  };

  const handleLogout = () => {
    setAuthUser(null);
  };

  const handleRegisterUser = (newUser: AuthUser) => {
    setRegisteredUsers((prev) => [newUser, ...prev]);
    const rawSecret = newUser.pin || '1234';
    const secureHash = rawSecret.startsWith('sha256$') ? rawSecret : hashPassword(rawSecret);
    // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS (Hash protegido)
    syncEntityToDatabase('system_users', {
      ...newUser,
      companyId: newUser.companyId,
      tenant_id: newUser.companyId,
      password_hash: secureHash,
      pin: '[PROTEGIDO]',
      is_active: true,
    });
  };

  // System Settings Handler
  const handleSaveSystemSettings = (newSettings: SystemSettings) => {
    setSystemSettings(newSettings);
    setCountSchedule(newSettings.countSchedule);
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        countDays: newSettings.countSchedule.defaultDays,
      }))
    );
    // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS
    syncEntityToDatabase('system_settings', newSettings);
  };

  // When changing roles, automatically adapt default tab to role's primary focus
  const handleSelectRole = (newRole: UserRole) => {
    setCurrentRole(newRole);
    if (authUser) {
      setAuthUser({
        ...authUser,
        role: newRole,
      });
    }
    if (!canAccessApiAndDatabase(newRole)) {
      setIsApiWorkbenchOpen(false);
    }
    if (newRole === 'conferente') {
      setActiveTab('contagem');
    } else if (newRole === 'compras') {
      setActiveTab('compras');
    } else if (newRole === 'gerente') {
      setActiveTab('perdas');
    }
  };

  // Stock health counts
  const criticalCount = items.filter((i) => getStockHealth(i).status === 'critico').length;
  const attentionCount = items.filter((i) => getStockHealth(i).status === 'atencao').length;

  // Handle Employee Count submission
  const handleFinishCount = (
    counts: Record<string, { count: number; expiry: string; obs: string }>,
    conferenteName: string,
    supervisorAuth?: SupervisorAuthorization
  ) => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Update items stock and currentBatchExpiry
    const updatedItems = items.map((item) => {
      const entry = counts[item.id];
      if (entry && entry.count !== undefined) {
        return {
          ...item,
          currentStock: entry.count,
          currentBatchExpiry: entry.expiry || item.currentBatchExpiry,
          lastCountDate: todayStr,
          lastCountBy: conferenteName,
        };
      }
      return item;
    });

    setItems(updatedItems);

    // Create session record
    const newSession: StockCountSession = {
      id: `session-${Date.now()}`,
      date: todayStr,
      conductedBy: conferenteName,
      userRole: currentRole,
      dayOfWeek: new Date().toLocaleDateString('pt-BR', { weekday: 'long' }),
      totalItemsCounted: Object.keys(counts).length,
      divergentItemsCount: Object.entries(counts).filter(
        ([id, val]) => val.count !== items.find((it) => it.id === id)?.currentStock
      ).length,
      status: 'enviada',
      submittedAt: new Date().toISOString(),
      supervisorAuthorization: supervisorAuth || supervisorAuthorization || undefined,
      entries: Object.entries(counts).map(([itemId, val]) => {
        const originalItem = items.find((it) => it.id === itemId);
        const health = originalItem ? getStockHealth({ ...originalItem, currentStock: val.count }) : null;
        return {
          itemId,
          countedStock: val.count,
          previousStock: originalItem?.currentStock || 0,
          expiryDate: val.expiry,
          observations: val.obs,
          status: health?.status === 'critico' ? 'critico' : health?.status === 'atencao' ? 'baixo' : 'ok',
        };
      }),
    };

    setCountSessions((prev) => [newSession, ...prev]);
    // Clear the active session authorization once finished
    setSupervisorAuthorization(null);

    // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS
    syncEntityToDatabase('stock_count_sessions', newSession);
    syncEntityToDatabase('stock_items', updatedItems);
  };

  // Handle saving count schedule (gerente e adm)
  const handleSaveSchedule = (newSchedule: CountScheduleConfig, applyToAllItems: boolean) => {
    setCountSchedule(newSchedule);
    setSystemSettings((prev) => ({
      ...prev,
      countSchedule: newSchedule,
      updatedAt: new Date().toISOString(),
      updatedBy: authUser ? `${authUser.name} (${authUser.role})` : 'Administrador',
    }));
    if (applyToAllItems) {
      setItems((prev) => {
        const updated = prev.map((item) => ({
          ...item,
          countDays: newSchedule.defaultDays,
        }));
        syncEntityToDatabase('stock_items', updated);
        return updated;
      });
    }
    // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS
    syncEntityToDatabase('system_settings', {
      ...systemSettings,
      countSchedule: newSchedule,
    });
  };

  // Handle supervisor authorization approval
  const handleAuthorizeSupervisor = (auth: SupervisorAuthorization) => {
    setSupervisorAuthorization(auth);
  };

  // Handle saving new loss (e.g. "uma batata frita queimou")
  const handleSaveLoss = (lossData: Omit<LossRecord, 'id' | 'timestamp'>) => {
    const newLoss: LossRecord = {
      ...lossData,
      id: `loss-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    setLosses((prev) => [newLoss, ...prev]);

    // Deduct stock from the affected item
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === lossData.itemId) {
          const updated = {
            ...it,
            currentStock: Math.max(0, it.currentStock - lossData.quantity),
          };
          syncEntityToDatabase('stock_items', updated);
          return updated;
        }
        return it;
      })
    );

    // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS
    syncEntityToDatabase('loss_records', newLoss);
  };

  // Handle saving purchase order (recorded when dispatched to WhatsApp or Email)
  const handleOrderCreated = (order: PurchaseOrder) => {
    setOrdersHistory((prev) => [order, ...prev]);
    // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS
    syncEntityToDatabase('purchase_orders', order);
  };

  // Handle updating stock items' primary supplier when buyer chooses to make the swap permanent
  const handleUpdateItemSupplier = (itemIds: string[], supplierId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (itemIds.includes(item.id)) {
          const updated = { ...item, primarySupplierId: supplierId };
          syncEntityToDatabase('stock_items', updated);
          return updated;
        }
        return item;
      })
    );
  };

  // Handle saving new/edited item
  const handleSaveItem = (item: StockItem) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      if (exists) {
        return prev.map((i) => (i.id === item.id ? item : i));
      }
      return [item, ...prev];
    });
    setEditingItem(null);
    // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS (Persistência no SGBD)
    syncEntityToDatabase('stock_items', {
      ...item,
      companyId: activeCompanyId || 'comp-matriz',
      tenant_id: activeCompanyId || 'comp-matriz',
    });
  };

  const handleDeleteItem = (id: string) => {
    if (window.confirm('Deseja realmente remover este item do estoque?')) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS
      deleteEntityFromDatabase('stock_items', id);
    }
  };

  const handleDeleteSupplier = (id: string) => {
    if (window.confirm('Deseja realmente remover este fornecedor?')) {
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS
      deleteEntityFromDatabase('suppliers', id);
    }
  };

  // Handle saving new/edited supplier and updating linked products
  const handleSaveSupplier = (supplier: Supplier, updatedItems?: StockItem[]) => {
    const enrichedSupplier: Supplier = {
      ...supplier,
      category: supplier.category || 'Geral',
    };

    setSuppliers((prev) => {
      const exists = prev.some((s) => s.id === enrichedSupplier.id);
      if (exists) {
        return prev.map((s) => (s.id === enrichedSupplier.id ? enrichedSupplier : s));
      }
      return [enrichedSupplier, ...prev];
    });

    if (updatedItems && updatedItems.length > 0) {
      setItems(updatedItems);
      syncEntityToDatabase('stock_items', updatedItems);
    }

    // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS COM TENANT GARANTIDO
    syncEntityToDatabase('suppliers', {
      ...enrichedSupplier,
      companyId: activeCompanyId || 'comp-matriz',
      tenant_id: activeCompanyId || 'comp-matriz',
    });
  };

  // Handle quick stock adjustment from Estoque Geral
  const handleUpdateItemStock = (itemId: string, newStock: number, reason: string) => {
    const activeEmp = employees.find((e) => e.companyId === activeCompanyId);
    const authorName = activeEmp ? `${activeEmp.name} (${activeEmp.role})` : `${currentRole.toUpperCase()}`;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const updated = {
            ...item,
            currentStock: Math.max(0, newStock),
            lastCountDate: new Date().toISOString().split('T')[0],
            lastCountBy: `${authorName} (Ajuste: ${reason})`,
          };
          syncEntityToDatabase('stock_items', updated);
          return updated;
        }
        return item;
      })
    );
  };

  // Handle confirming invoice import (NF-e)
  const handleConfirmInvoiceImport = (
    invoice: InvoiceData,
    updatedItems: StockItem[],
    newSuppliers?: Supplier[],
    linkedOrderId?: string,
    orderFulfillmentType?: 'total' | 'parcial',
    updatedOrder?: PurchaseOrder
  ) => {
    setItems(updatedItems);
    if (newSuppliers && newSuppliers.length > 0) {
      setSuppliers((prev) => [...newSuppliers, ...prev]);
      syncEntityToDatabase('suppliers', newSuppliers);
    }
    setImportedInvoices((prev) => [invoice, ...prev]);

    // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS
    syncEntityToDatabase('invoices_history', invoice);
    syncEntityToDatabase('stock_items', updatedItems);

    // Fechamento Parcial ou Total do Pedido de Compra Vinculado
    if (linkedOrderId && updatedOrder) {
      setOrdersHistory((prev) =>
        prev.map((ord) => (ord.id === linkedOrderId ? updatedOrder : ord))
      );
      syncEntityToDatabase('purchase_orders', updatedOrder);
    }
  };

  // Multi-Company Handlers (Administrador)
  const handleSaveCompany = (company: Company) => {
    setCompanies((prev) => {
      const exists = prev.some((c) => c.id === company.id);
      if (exists) {
        return prev.map((c) => (c.id === company.id ? company : c));
      }
      return [...prev, company];
    });
    // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS
    syncEntityToDatabase('tenants_companies', company);
  };

  const handleDeleteCompany = (id: string) => {
    if (companies.length <= 1) {
      alert('Não é possível excluir a única empresa cadastrada.');
      return;
    }
    setCompanies((prev) => prev.filter((c) => c.id !== id));
    if (activeCompanyId === id) {
      const remaining = companies.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        setActiveCompanyId(remaining[0].id);
      }
    }
    // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS
    deleteEntityFromDatabase('tenants_companies', id);
  };

  const handleToggleCompanyStatus = (id: string) => {
    setCompanies((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const updated = { ...c, active: !c.active };
          syncEntityToDatabase('tenants_companies', updated);
          return updated;
        }
        return c;
      })
    );
  };

  // Employee Handlers (Gerente & Administrador)
  const handleSaveEmployee = (emp: Employee) => {
    const rawCompanyCnpj = (activeCompany?.cnpj ? cleanCNPJ(activeCompany.cnpj) : '') || activeCompany?.id || activeCompanyId || '00000000000001';
    const cleanTenant = rawCompanyCnpj.replace(/^comp-matriz$|^emp-matriz$/, '00000000000001');

    const fullEmp: Employee = {
      ...emp,
      companyId: cleanTenant,
    };

    setEmployees((prev) => {
      const exists = prev.some((e) => e.id === fullEmp.id);
      if (exists) {
        return prev.map((e) => (e.id === fullEmp.id ? fullEmp : e));
      }
      return [fullEmp, ...prev];
    });

    // Registra nos acessos autenticados para permitir login imediato
    setRegisteredUsers((prev) => {
      const exists = prev.some((u) => u.id === fullEmp.id || u.email.toLowerCase() === fullEmp.email.toLowerCase());
      const authUser: AuthUser = {
        id: fullEmp.id,
        name: fullEmp.name,
        email: fullEmp.email,
        role: fullEmp.role,
        companyId: fullEmp.companyId,
        companyName: activeCompany?.name || 'CEC Conecta',
        phone: fullEmp.phone,
        pin: '@dm!n2026',
        lastLogin: new Date().toISOString(),
      };
      if (exists) {
        return prev.map((u) => (u.id === fullEmp.id || u.email.toLowerCase() === fullEmp.email.toLowerCase() ? authUser : u));
      }
      return [authUser, ...prev];
    });

    // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS (Persistência no SGBD com hash seguro)
    const rawPin = (fullEmp as any).pin || '@dm!n2026';
    const secureHash = rawPin.startsWith('sha256$') ? rawPin : hashPassword(rawPin);

    syncEntityToDatabase('system_users', {
      ...fullEmp,
      companyId: cleanTenant,
      tenant_id: cleanTenant,
      password_hash: secureHash,
      pin: '[PROTEGIDO]',
      is_active: fullEmp.status === 'ativo',
    });
  };

  const handleDeleteEmployee = (id: string) => {
    const target = employees.find((e) => e.id === id);
    if (!target) return;
    if (!canBlockOrDeleteGerente(currentRole, target.role)) {
      alert('Somente Administrador ou Gerente podem excluir ou bloquear cadastros de Gerente.');
      return;
    }
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS
    deleteEntityFromDatabase('system_users', id);
  };

  const handleToggleEmployeeStatus = (id: string) => {
    const target = employees.find((e) => e.id === id);
    if (!target) return;
    if (!canBlockOrDeleteGerente(currentRole, target.role)) {
      alert('Somente Administrador ou Gerente podem excluir ou bloquear cadastros de Gerente.');
      return;
    }
    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id === id) {
          const updated = { ...e, status: (e.status === 'ativo' ? 'bloqueado' : 'ativo') as 'ativo' | 'bloqueado' };
          syncEntityToDatabase('system_users', updated);
          return updated;
        }
        return e;
      })
    );
  };

  // Unlisted Item Handlers (Conferente -> Compras/Gerente approval)
  const handleRecordUnlistedItem = (newItem: UnlistedCountItem) => {
    setUnlistedItems((prev) => [newItem, ...prev]);
    // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS
    syncEntityToDatabase('unlisted_count_items', newItem);
  };

  const handleApproveUnlistedItem = (
    unlistedItem: UnlistedCountItem,
    finalStockItem: Omit<StockItem, 'id'>
  ) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const existingIndex = items.findIndex(
      (i) => i.name.toLowerCase().trim() === unlistedItem.name.toLowerCase().trim()
    );

    let stockItemId = '';
    let savedStockItem: StockItem;

    if (existingIndex >= 0) {
      const existing = items[existingIndex];
      stockItemId = existing.id;
      savedStockItem = {
        ...existing,
        ...finalStockItem,
        id: existing.id,
        currentStock: finalStockItem.currentStock,
        lastCountDate: todayStr,
        lastCountBy: `${unlistedItem.recordedBy} (Aprovado por ${currentRole})`,
      };
      setItems((prev) => prev.map((it, idx) => (idx === existingIndex ? savedStockItem : it)));
    } else {
      stockItemId = `item-${Date.now()}`;
      savedStockItem = {
        ...finalStockItem,
        id: stockItemId,
        lastCountDate: todayStr,
        lastCountBy: `${unlistedItem.recordedBy} (Aprovado)`,
      };
      setItems((prev) => [savedStockItem, ...prev]);
    }

    // ALIMENTAÇÃO DA ROTA DO BANCO DE DADOS
    syncEntityToDatabase('stock_items', savedStockItem);

    const approvedUnlisted = {
      ...unlistedItem,
      status: 'aprovado' as const,
      approvedBy: currentRole === 'administrador' ? 'Administrador do Sistema' : 'Gerência / Compras',
      approvedAt: new Date().toISOString(),
      createdStockItemId: stockItemId,
    };

    setUnlistedItems((prev) =>
      prev.map((it) => (it.id === unlistedItem.id ? approvedUnlisted : it))
    );
    syncEntityToDatabase('unlisted_count_items', approvedUnlisted);
  };

  const handleRejectUnlistedItem = (unlistedItemId: string, reason: string) => {
    setUnlistedItems((prev) =>
      prev.map((it) => {
        if (it.id === unlistedItemId) {
          const rejected = {
            ...it,
            status: 'rejeitado' as const,
            rejectionReason: reason || 'Não autorizado para inclusão no estoque',
          };
          syncEntityToDatabase('unlisted_count_items', rejected);
          return rejected;
        }
        return it;
      })
    );
  };

  // Se não houver usuário autenticado, exibe a tela de login individual
  if (!authUser) {
    return (
      <LoginView
        onLogin={handleLogin}
        registeredUsers={registeredUsers}
        onRegisterUser={handleRegisterUser}
        companies={companies}
        activeCompanyId={activeCompanyId}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Banner de Tolerância / Dunning (exibido apenas se past_due dentro do grace period) */}
      <BillingGracePeriodBanner />

      {/* App Header */}
      <Header
        currentRole={currentRole}
        onSelectRole={handleSelectRole}
        criticalCount={criticalCount}
        attentionCount={attentionCount}
        onOpenLossModal={() => setIsLossModalOpen(true)}
        onOpenNewItemModal={() => {
          setEditingItem(null);
          setIsItemModalOpen(true);
        }}
        onOpenSuppliersModal={() => setIsSuppliersModalOpen(true)}
        onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
        onOpenInvoiceImporter={() => setActiveTab('notas')}
        onOpenApiWorkbench={() => setIsApiWorkbenchOpen(true)}
        onOpenSystemSettings={() => {
          setSystemSettingsTab('precos');
          setIsSystemSettingsOpen(true);
        }}
        authUser={authUser}
        onLogout={handleLogout}
        defaultCountDays={countSchedule.defaultDays}
        activeCompanyName={activeCompany?.name || 'CEC Conecta'}
        onOpenCompanyModal={() => setIsCompanyModalOpen(true)}
        onOpenEmployeesModal={() => setIsEmployeesModalOpen(true)}
        pendingUnlistedCount={unlistedItems.filter((i) => i.companyId === activeCompanyId && i.status === 'pendente').length}
        onOpenUnlistedApprovalModal={() => setIsUnlistedApprovalOpen(true)}
      />

      {/* Navigation Tabs */}
      <Navigation
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        currentRole={currentRole}
        criticalCount={criticalCount}
        attentionCount={attentionCount}
        lossesCountMonth={losses.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Verificação de Permissão: Se o perfil do usuário (ex: conferente) tentar acessar um módulo restrito */}
        {!isTabAllowedForRole(activeTab, currentRole) ? (
          <AccessDeniedView
            attemptedTab={activeTab}
            currentRole={currentRole}
            onNavigateToAllowed={() => setActiveTab('contagem')}
            onLogout={handleLogout}
          />
        ) : (
          <>
            {/* VIEW: Estoque Geral (Saldos em tempo real, lotes, fornecedores vinculados e ajustes) */}
            {activeTab === 'estoque' && (
              <GeneralStockView
                items={items}
                suppliers={suppliers}
                companyName={activeCompany?.name || 'Desenvolvimento de Software'}
                currentRole={currentRole}
                onUpdateItemStock={handleUpdateItemStock}
                onOpenNewItemModal={() => {
                  setEditingItem(null);
                  setIsItemModalOpen(true);
                }}
                onOpenLossModal={(preselectedItemId) => {
                  setIsLossModalOpen(true);
                }}
                onOpenSuppliersModal={() => setIsSuppliersModalOpen(true)}
                onNavigateToCompras={(preselectedItemId) => {
                  setActiveTab('compras');
                }}
              />
            )}

            {/* VIEW 1: Caminho do Funcionário / Conferente (Contagem de Estoque) */}
            {activeTab === 'contagem' && (
              <EmployeeCountView
                items={items}
                onFinishCount={handleFinishCount}
                lastSessionDate={countSessions[0]?.date}
                conferenteName="Lucas Santos (Conferente)"
                currentRole={currentRole}
                defaultCountDays={countSchedule.defaultDays}
                supervisorAuthorization={supervisorAuthorization}
                onRequestSupervisorRelease={() => setIsReleaseModalOpen(true)}
                onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
                onOpenRecordUnlisted={() => setIsRecordUnlistedOpen(true)}
              />
            )}

            {/* VIEW 2: Caminho do Comprador / Proprietário (Compras & Reposição) */}
            {activeTab === 'compras' && (
              <BuyerRestockView
                items={items}
                suppliers={suppliers}
                onOrderCreated={handleOrderCreated}
                ordersHistory={ordersHistory}
                currentRole={currentRole}
                onSwitchRole={handleSelectRole}
                onOpenInvoiceImporter={(orderId?: string) => {
                  if (orderId) {
                    setPreselectedOrderIdForInvoice(orderId);
                  }
                  setActiveTab('notas');
                }}
                onUpdateItemSupplier={handleUpdateItemSupplier}
                systemSettings={systemSettings}
                onOpenSystemSettings={() => setIsSystemSettingsOpen(true)}
              />
            )}

            {/* VIEW: Orçamento & Cotações Agrupadas por Maior Variedade de Fornecedor */}
            {activeTab === 'orcamento' && (
              <BudgetQuotesView
                items={items}
                suppliers={suppliers}
                companyName={activeCompany?.name || 'Desenvolvimento de Software'}
                currentRole={currentRole}
                onInitiateOrderFromBudget={(supplier, itemsToOrder, quantities) => {
                  setActiveTab('compras');
                }}
              />
            )}

            {/* VIEW: Entrada de Estoque por Nota Fiscal / QR Code / Chave */}
            {activeTab === 'notas' && (
              <InvoiceImporterView
                items={items}
                suppliers={suppliers}
                onConfirmInvoiceImport={handleConfirmInvoiceImport}
                onSaveSupplier={handleSaveSupplier}
                importedInvoicesHistory={importedInvoices}
                ordersHistory={ordersHistory}
                onUpdatePurchaseOrder={(updatedOrder) => {
                  setOrdersHistory((prev) =>
                    prev.map((ord) => (ord.id === updatedOrder.id ? updatedOrder : ord))
                  );
                }}
                preselectedOrderId={preselectedOrderIdForInvoice}
                onClearPreselectedOrder={() => setPreselectedOrderIdForInvoice(null)}
                currentRole={currentRole}
                onNavigateToCatalog={() => setActiveTab('catalogo')}
                onNavigateToCompras={() => setActiveTab('compras')}
              />
            )}

            {/* VIEW 3: Gestão de Perdas & CMV (Batata queimou, descarte, quebras) */}
            {activeTab === 'perdas' && (
              <LossesView
                losses={losses}
                items={items}
                onOpenLossModal={() => setIsLossModalOpen(true)}
              />
            )}

            {/* VIEW 4: Dashboard Mensal com Gráficos */}
            {activeTab === 'dashboard' && (
              <DashboardView
                monthlyData={monthlyMetrics}
                items={items}
                losses={losses}
              />
            )}

            {/* VIEW 5: Catálogo & Parâmetros */}
            {activeTab === 'catalogo' && (
              <ItemsCatalogView
                items={items}
                suppliers={suppliers}
                onOpenNewItemModal={() => {
                  setEditingItem(null);
                  setIsItemModalOpen(true);
                }}
                onEditItem={(item) => {
                  setEditingItem(item);
                  setIsItemModalOpen(true);
                }}
                onDeleteItem={handleDeleteItem}
                currentRole={currentRole}
                onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* MODAL: Anotar Perda Rápida (CMV) */}
      <LossRegisterModal
        isOpen={isLossModalOpen}
        onClose={() => setIsLossModalOpen(false)}
        items={items}
        onSaveLoss={handleSaveLoss}
      />

      {/* MODAL: Novo Item ou Editar Item */}
      <ItemModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
        suppliers={suppliers}
        editingItem={editingItem}
        currentRole={currentRole}
        defaultCountDays={countSchedule.defaultDays}
      />

      {/* MODAL: Gestão de Fornecedores & Vínculo de Produtos */}
      <SuppliersModal
        isOpen={isSuppliersModalOpen}
        onClose={() => setIsSuppliersModalOpen(false)}
        suppliers={suppliers}
        items={items}
        onSaveSupplier={handleSaveSupplier}
        onDeleteSupplier={handleDeleteSupplier}
        currentRole={currentRole}
      />

      {/* MODAL: Gerente & Administrador - Alterar Dias Padrão de Contagem */}
      <CountScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        currentSchedule={countSchedule}
        onSaveSchedule={handleSaveSchedule}
        currentRole={currentRole}
      />

      {/* MODAL: Liberação de Conferência por Superior (ADM / Gerente) para Conferente */}
      <SupervisorReleaseModal
        isOpen={isReleaseModalOpen}
        onClose={() => setIsReleaseModalOpen(false)}
        onAuthorize={handleAuthorizeSupervisor}
        currentRole={currentRole}
        currentDayName={new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}
      />

      {/* SaaS Billing: Tela de Bloqueio (Paywall) se tolerância de 5 dias expirou ou cancelado */}
      <BillingOverduePaywall currentRole={currentRole} />

      {/* SaaS Billing: Modal de Gestão da Assinatura e Faturas (Somente Adm e Gerente) */}
      <BillingModal currentRole={currentRole} />

      {/* SaaS Billing: Painel de Simulação de Estados, Webhooks e Dunning */}
      <BillingSimulationDrawer />

      {/* SaaS Inventory: Bancada de Testes de API, Transações Atômicas, Barcode e Schema SQL (Somente Administrador) */}
      <OnlineInventoryApiWorkbench
        isOpen={isApiWorkbenchOpen}
        onClose={() => setIsApiWorkbenchOpen(false)}
        currentRole={currentRole}
      />

      {/* MODAL: Gestão de Empresas / Multi-Tenant (Somente Administrador com Trânsito e Suporte) */}
      <CompanyManagementModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        companies={companies}
        activeCompanyId={activeCompanyId}
        onSelectCompany={(id) => setActiveCompanyId(id)}
        onSaveCompany={handleSaveCompany}
        currentRole={currentRole}
      />

      {/* MODAL: Gestão de Funcionários por Empresa (Gerente e Administrador com RBAC rígido) */}
      <EmployeesManagementModal
        isOpen={isEmployeesModalOpen}
        onClose={() => setIsEmployeesModalOpen(false)}
        employees={employees}
        activeCompany={activeCompany}
        currentRole={currentRole}
        onSaveEmployee={handleSaveEmployee}
        onDeleteEmployee={handleDeleteEmployee}
        onToggleStatus={handleToggleEmployeeStatus}
      />

      {/* MODAL: Conferente - Anotar Produto Fora da Lista na Contagem Física */}
      <RecordUnlistedItemModal
        isOpen={isRecordUnlistedOpen}
        onClose={() => setIsRecordUnlistedOpen(false)}
        companyId={activeCompanyId}
        conferenteName="Lucas Santos (Conferente)"
        onSaveUnlistedItem={handleRecordUnlistedItem}
      />

      {/* MODAL: Compras e Gerente - Aprovar Contagem de Produtos Fora da Lista */}
      <UnlistedItemsApprovalModal
        isOpen={isUnlistedApprovalOpen}
        onClose={() => setIsUnlistedApprovalOpen(false)}
        unlistedItems={unlistedItems.filter((i) => i.companyId === activeCompanyId && i.status === 'pendente')}
        suppliers={suppliers}
        companyName={activeCompany?.name || 'Empresa'}
        currentRole={currentRole}
        onApproveItem={handleApproveUnlistedItem}
        onRejectItem={handleRejectUnlistedItem}
      />

      {/* ASSISTENTE DE SETUP & SINCRONIZAÇÃO INICIAL (Primeiro acesso / CNPJ 00000000000000) */}
      <InitialSetupWizardModal
        isOpen={isInitialSetupWizardOpen}
        onClose={() => setIsInitialSetupWizardOpen(false)}
        onSaveCompany={handleSaveCompany}
        onCompleteSetup={(newTenantId) => {
          setActiveCompanyId(newTenantId);
          fetchAllDatabaseData().then((dbData) => {
            if (dbData && dbData.tables) {
              console.log('[Setup Complete] Dados recarregados do SGBD com sucesso.');
            }
          });
        }}
        existingCompanies={companies}
        currentRole={currentRole}
        onOpenParametrizacaoDatabase={() => {
          setSystemSettingsTab('database');
          setIsSystemSettingsOpen(true);
        }}
      />

      {/* MODAL: Parametrização Sistêmica (Exclusivo Administrador com aba de Banco sempre disponível) */}
      <SystemSettingsModal
        isOpen={isSystemSettingsOpen}
        onClose={() => setIsSystemSettingsOpen(false)}
        settings={systemSettings}
        onSaveSettings={handleSaveSystemSettings}
        currentRole={currentRole}
        currentUserName={authUser ? `${authUser.name} (${authUser.role})` : 'Administrador Geral'}
        initialTab={systemSettingsTab}
      />

      {/* Subtle Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Controle de Estoque & Análise de CMV • Restaurantes e Bares
          </span>
          <div className="flex items-center gap-2.5 text-slate-400 flex-wrap justify-center">
            <span>
              Dias Padrão:{' '}
              <strong className="text-slate-300 capitalize">
                {countSchedule.defaultDays.join(' e ')}
              </strong>
            </span>
            <span>•</span>
            <span>4 Níveis de Acesso (RBAC)</span>
            <span>•</span>
            <button
              id="btn-footer-theme-toggle"
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Alternar entre tema claro e escuro"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Modo Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Modo Escuro</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
