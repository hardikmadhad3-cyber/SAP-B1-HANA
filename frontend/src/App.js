import { Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import Layout from "./components/Layout";
import LazyLoadErrorBoundary from "./components/LazyLoadErrorBoundary";
import RouteLoadingFallback from "./components/RouteLoadingFallback";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import {
  RequireAdminAuth,
  RequireAuth,
  RequirePendingSelection,
  RouteFallback,
} from "./auth/RouteGuards";

import Dashboard from "./pages/Dashboard";
import AdminLoginPage from "./pages/AdminLoginPage";
import LoginPage from "./pages/LoginPage";
import lazyWithRetry from "./utils/lazyWithRetry";
import { focusFirstSapField, installSapTabNavigation } from "./utils/sapTabNavigation";
import "./App.css";
import "./styles/auth.css";
import "./styles/admin-panel.css";
import "./styles/sap-ui.css";
import "./styles/route-loading.css";

const ItemMaster = lazyWithRetry(() => import("./pages/ItemMaster"));
const ItemMasterList = lazyWithRetry(() => import("./pages/ItemMasterList"));
const BusinessPartner = lazyWithRetry(() => import("./pages/BusinessPartner"));
const BusinessPartnerList = lazyWithRetry(() => import("./pages/BusinessPartnerList"));
const Warehouse = lazyWithRetry(() => import("./pages/Warehouse"));
const PriceList = lazyWithRetry(() => import("./pages/PriceList"));
const Delivery = lazyWithRetry(() => import("./pages/Delivery"));
const DeliveryList = lazyWithRetry(() => import("./pages/DeliveryList"));
const DCDelivery = lazyWithRetry(() => import("./pages/DCDelivery"));
const DCDeliveryList = lazyWithRetry(() => import("./pages/DCDeliveryList"));
const NCDelivery = lazyWithRetry(() => import("./pages/NCDelivery"));
const NCDeliveryList = lazyWithRetry(() => import("./pages/NCDeliveryList"));
const SODADelivery = lazyWithRetry(() => import("./pages/SODADelivery"));
const SODADeliveryList = lazyWithRetry(() => import("./pages/SODADeliveryList"));
const TaxCode = lazyWithRetry(() => import("./pages/TaxCode"));
const UoMGroup = lazyWithRetry(() => import("./pages/UoMGroup"));
const PaymentTerms = lazyWithRetry(() => import("./pages/PaymentTerms"));
const ShippingType = lazyWithRetry(() => import("./pages/ShippingType"));
const Branch = lazyWithRetry(() => import("./pages/Branch"));
const ChartOfAccounts = lazyWithRetry(() => import("./pages/ChartOfAccounts"));
const GoodsReceipt = lazyWithRetry(() => import("./pages/GoodsReceipt"));
const GoodsReceiptList = lazyWithRetry(() => import("./pages/GoodsReceiptList"));
const GoodsIssue = lazyWithRetry(() => import("./pages/GoodsIssue"));
const GoodsIssueList = lazyWithRetry(() => import("./pages/GoodsIssueList"));
const InventoryTransferRequest = lazyWithRetry(() => import("./pages/InventoryTransferRequest"));
const InventoryTransferRequestList = lazyWithRetry(() => import("./pages/InventoryTransferRequestList"));
const InventoryTransfer = lazyWithRetry(() => import("./pages/InventoryTransfer"));
const InventoryTransferList = lazyWithRetry(() => import("./pages/InventoryTransferList"));
const PurchaseOrder = lazyWithRetry(() => import("./pages/PurchaseOrder"));
const PurchaseOrderList = lazyWithRetry(() => import("./pages/PurchaseOrderList"));
const PurchaseQuotation = lazyWithRetry(() => import("./pages/PurchaseQuotation"));
const PurchaseQuotationList = lazyWithRetry(() => import("./pages/PurchaseQuotationList"));
const PurchaseRequest = lazyWithRetry(() => import("./pages/PurchaseRequest"));
const PurchaseRequestList = lazyWithRetry(() => import("./pages/PurchaseRequestList"));
const GoodsReceiptPO = lazyWithRetry(() => import("./pages/GRPO"));
const GRPOList = lazyWithRetry(() => import("./pages/GRPOList"));
const SalesOrder = lazyWithRetry(() => import("./pages/SalesOrder"));
const SalesOrderList = lazyWithRetry(() => import("./pages/SalesOrderList"));
const DCSalesOrder = lazyWithRetry(() => import("./pages/DCSalesOrder"));
const DCSalesOrderList = lazyWithRetry(() => import("./pages/DCSalesOrderList"));
const NCSalesOrder = lazyWithRetry(() => import("./pages/NCSalesOrder"));
const NCSalesOrderList = lazyWithRetry(() => import("./pages/NCSalesOrderList"));
const SODASalesOrder = lazyWithRetry(() => import("./pages/SODASalesOrder"));
const SODASalesOrderList = lazyWithRetry(() => import("./pages/SODASalesOrderList"));
const BOM = lazyWithRetry(() => import("./pages/BOM"));
const ProductionOrder = lazyWithRetry(() => import("./pages/ProductionOrder"));
const IssueForProduction = lazyWithRetry(() => import("./pages/IssueForProduction"));
const ReceiptFromProduction = lazyWithRetry(() => import("./pages/ReceiptFromProduction"));
const APInvoice = lazyWithRetry(() => import("./pages/APInvoice"));
const APInvoiceList = lazyWithRetry(() => import("./pages/APInvoiceList"));
const ARInvoice = lazyWithRetry(() => import("./pages/ARInvoice"));
const ARInvoiceList = lazyWithRetry(() => import("./pages/ARInvoiceList"));
const ServiceARInvoice = lazyWithRetry(() => import("./pages/ServiceARInvoice"));
const ServiceARInvoiceList = lazyWithRetry(() => import("./pages/ServiceARInvoiceList"));
const ServiceAPInvoice = lazyWithRetry(() => import("./pages/ServiceAPInvoice"));
const ServiceAPInvoiceList = lazyWithRetry(() => import("./pages/ServiceAPInvoiceList"));
const APCreditMemo = lazyWithRetry(() => import("./pages/APCreditMemo"));
const APCreditMemoList = lazyWithRetry(() => import("./pages/APCreditMemoList"));
const ARCreditMemo = lazyWithRetry(() => import("./pages/ARCreditMemo"));
const ARCreditMemoList = lazyWithRetry(() => import("./pages/ARCreditMemoList"));
const IncomingPayments = lazyWithRetry(() => import("./pages/IncomingPayments"));
const OutgoingPayments = lazyWithRetry(() => import("./pages/OutgoingPayments"));
const SalesQuotation = lazyWithRetry(() => import("./pages/SalesQuotation"));
const SalesQuotationList = lazyWithRetry(() => import("./pages/SalesQuotationList"));
const SalesAnalysisReportPage = lazyWithRetry(() => import("./pages/SalesAnalysisReportPage"));
const PurchaseAnalysisReport = lazyWithRetry(() => import("./pages/PurchaseAnalysisReport"));
const PurchaseRequestReportPage = lazyWithRetry(() => import("./pages/PurchaseRequestReportPage"));
const ReportsStudioPage = lazyWithRetry(() => import("./pages/ReportsStudioPage"));
const ReportRunnerPage = lazyWithRetry(() => import("./pages/ReportRunnerPage"));
const AdminPanelHome = lazyWithRetry(() => import("./pages/AdminPanelHome"));
const AdminPanelEntity = lazyWithRetry(() => import("./pages/AdminPanelEntity"));

const DEFAULT_DOCUMENT_TITLE = "SAP Business One";

const getCompanyDocumentTitle = (company) => {
  const companyName = String(company?.companyName || "").trim();
  const dbName = String(company?.dbName || "").trim();

  return companyName || dbName || DEFAULT_DOCUMENT_TITLE;
};

function CompanyTitleManager() {
  const { company, isAuthenticated, isAdminAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      document.title = getCompanyDocumentTitle(company);
      return;
    }

    document.title = isAdminAuthenticated ? "SAP B1 Admin" : DEFAULT_DOCUMENT_TITLE;
  }, [company?.companyName, company?.dbName, isAuthenticated, isAdminAuthenticated]);

  return null;
}

function SapInitialFocusManager() {
  const location = useLocation();

  useEffect(() => {
    focusFirstSapField(180);
    focusFirstSapField(520);
  }, [location.pathname, location.search]);

  return null;
}

function App() {
  useEffect(() => installSapTabNavigation(), []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <CompanyTitleManager />
        <SapInitialFocusManager />
        <LazyLoadErrorBoundary>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              <Route
                path="/login"
                element={<LoginPage />}
              />

              <Route
                path="/admin-login"
                element={<AdminLoginPage />}
              />

              <Route
                path="/company-select"
                element={
                  <RequirePendingSelection>
                    <Navigate to="/login" replace />
                  </RequirePendingSelection>
                }
              />

              <Route element={<RequireAuth />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/item-master" element={<ItemMaster />} />
                  <Route path="/item-master/find" element={<ItemMasterList />} />
                  <Route path="/business-partner" element={<BusinessPartner />} />
                  <Route path="/business-partner/find" element={<BusinessPartnerList />} />
                  <Route path="/warehouse" element={<Warehouse />} />
                  <Route path="/price-list" element={<PriceList />} />
                  <Route path="/tax-code" element={<TaxCode />} />
                  <Route path="/uom-group" element={<UoMGroup />} />
                  <Route path="/payment-terms" element={<PaymentTerms />} />
                  <Route path="/goods-receipt" element={<GoodsReceipt />} />
                  <Route path="/goods-receipt/find" element={<GoodsReceiptList />} />
                  <Route path="/goods-issue" element={<GoodsIssue />} />
                  <Route path="/goods-issue/find" element={<GoodsIssueList />} />
                  <Route path="/inventory-transfer-request" element={<InventoryTransferRequest />} />
                  <Route path="/inventory-transfer-request/find" element={<InventoryTransferRequestList />} />
                  <Route path="/inventory-transfer" element={<InventoryTransfer />} />
                  <Route path="/inventory-transfer/find" element={<InventoryTransferList />} />
                  <Route path="/delivery" element={<Delivery />} />
                  <Route path="/delivery/new" element={<Delivery />} />
                  <Route path="/Delivery" element={<Navigate to="/delivery" replace />} />
                  <Route path="/delivery/find" element={<DeliveryList />} />
                  <Route path="/dc-delivery" element={<DCDelivery />} />
                  <Route path="/dc-delivery/new" element={<DCDelivery />} />
                  <Route path="/dc-delivery/find" element={<DCDeliveryList />} />
                  <Route path="/nc-delivery" element={<NCDelivery />} />
                  <Route path="/nc-delivery/new" element={<NCDelivery />} />
                  <Route path="/nc-delivery/find" element={<NCDeliveryList />} />
                  <Route path="/soda-delivery" element={<SODADelivery />} />
                  <Route path="/soda-delivery/new" element={<SODADelivery />} />
                  <Route path="/soda-delivery/find" element={<SODADeliveryList />} />
                  <Route path="/shipping-type" element={<ShippingType />} />
                  <Route path="/branch" element={<Branch />} />
                  <Route path="/chart-of-accounts" element={<ChartOfAccounts />} />
                  <Route path="/purchase-order" element={<PurchaseOrder />} />
                  <Route path="/purchase-order/find" element={<PurchaseOrderList />} />
                  <Route path="/purchase-quotation" element={<PurchaseQuotation />} />
                  <Route path="/purchase-quotation/find" element={<PurchaseQuotationList />} />
                  <Route path="/purchase-request" element={<PurchaseRequest />} />
                  <Route path="/purchase-request/find" element={<PurchaseRequestList />} />
                  <Route path="/grpo" element={<GoodsReceiptPO />} />
                  <Route path="/grpo/find" element={<GRPOList />} />
                  <Route path="/sales-order" element={<SalesOrder />} />
                  <Route path="/sales-order/old" element={<SalesOrder />} />
                  <Route path="/sales-order/find" element={<SalesOrderList />} />
                  <Route path="/dc-sales-order" element={<DCSalesOrder />} />
                  <Route path="/dc-sales-order/find" element={<DCSalesOrderList />} />
                  <Route path="/nc-sales-order" element={<NCSalesOrder />} />
                  <Route path="/nc-sales-order/find" element={<NCSalesOrderList />} />
                  <Route path="/soda-sales-order" element={<SODASalesOrder />} />
                  <Route path="/soda-sales-order/find" element={<SODASalesOrderList />} />
                  <Route path="/sales-quotation" element={<SalesQuotation />} />
                  <Route path="/sales-quotation/find" element={<SalesQuotationList />} />
                  <Route path="/reportlayoutmanager" element={<ReportsStudioPage />} />
                  <Route path="/reportlayoutmanager/menu/:menuId" element={<ReportRunnerPage />} />
                  <Route path="/reportlayoutmanager/report/:reportId" element={<ReportRunnerPage />} />
                  <Route path="/reports" element={<ReportsStudioPage />} />
                  <Route path="/reports/menu/:menuId" element={<ReportRunnerPage />} />
                  <Route path="/reports/report/:reportId" element={<ReportRunnerPage />} />
                  <Route path="/reports/sales/analysis" element={<SalesAnalysisReportPage />} />
                  <Route path="/reports/purchasing/analysis" element={<PurchaseAnalysisReport />} />
                  <Route path="/reports/purchase-analysis" element={<PurchaseAnalysisReport />} />
                  <Route path="/reports/purchase/analysis" element={<PurchaseAnalysisReport />} />
                  <Route path="/reports/purchasing/purchase-request-report" element={<PurchaseRequestReportPage />} />
                  <Route path="/bom" element={<BOM />} />
                  <Route path="/production-order" element={<ProductionOrder />} />
                  <Route path="/issue-for-production" element={<IssueForProduction />} />
                  <Route path="/receipt-from-production" element={<ReceiptFromProduction />} />
                  <Route path="/ap-invoice" element={<APInvoice />} />
                  <Route path="/ap-invoice/find" element={<APInvoiceList />} />
                  <Route path="/ar-invoice" element={<ARInvoice />} />
                  <Route path="/ar-invoice/find" element={<ARInvoiceList />} />
                  <Route path="/services/ar-invoice" element={<ServiceARInvoice />} />
                  <Route path="/services/ar-invoice/find" element={<ServiceARInvoiceList />} />
                  <Route path="/services/ap-invoice" element={<ServiceAPInvoice />} />
                  <Route path="/services/ap-invoice/find" element={<ServiceAPInvoiceList />} />
                  <Route path="/ar-credit-memo" element={<ARCreditMemo />} />
                  <Route path="/ar-credit-memo/find" element={<ARCreditMemoList />} />
                  <Route path="/ap-credit-memo" element={<APCreditMemo />} />
                  <Route path="/ap-credit-memo/find" element={<APCreditMemoList />} />
                  <Route path="/incoming-payments" element={<IncomingPayments />} />
                  <Route path="/outgoing-payments" element={<OutgoingPayments />} />
                </Route>
              </Route>

              <Route element={<RequireAdminAuth />}>
                <Route element={<Layout />}>
                  <Route path="/admin" element={<AdminPanelHome />} />
                  <Route path="/admin/:entityKey" element={<AdminPanelEntity />} />
                  <Route path="/admin/:entityKey/new" element={<AdminPanelEntity />} />
                  <Route path="/admin/:entityKey/:recordId" element={<AdminPanelEntity />} />
                </Route>
              </Route>

              <Route path="*" element={<RouteFallback />} />
            </Routes>
          </Suspense>
        </LazyLoadErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
