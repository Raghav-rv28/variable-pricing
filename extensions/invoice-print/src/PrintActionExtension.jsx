import {
  reactExtension,
  useApi,
  AdminPrintAction,
  Banner,
  BlockStack,
  Checkbox,
  Text,
} from "@shopify/ui-extensions-react/admin";
import { useEffect, useState } from "react";

// The target used here must match the target used in the extension's toml file (./shopify.extension.toml)
const TARGET = "admin.order-details.print-action.render";

export default reactExtension(TARGET, () => <App />);

function App() {
  // The useApi hook provides access to several useful APIs like i18n and data.
  const {i18n, data} = useApi(TARGET);
  const [src, setSrc] = useState(null);
  
  // Document selection states
  const [printInvoice, setPrintInvoice] = useState(true);
  const [printPackingSlip, setPrintPackingSlip] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(false);
  
  // data has information about the resource to be printed.
  console.log({ data });

  // Build the print URL based on selected documents and order data
  useEffect(() => {
    const printTypes = [];
    
    if (printInvoice) {
      printTypes.push("Invoice");
    }
    if (printPackingSlip) {
      printTypes.push("Packing Slip");
    }
    if (printReceipt) {
      printTypes.push("Receipt");
    }

    if (printTypes.length > 0 && data?.selected?.[0]?.id) {
      const params = new URLSearchParams({
        printType: printTypes.join(','),
        orderId: data.selected[0].id
      });
      
      const fullSrc = `/print?${params.toString()}`;
      setSrc(fullSrc);
    } else {
      setSrc(null);
    }
  }, [data?.selected, printInvoice, printPackingSlip, printReceipt]);

  return (
    <AdminPrintAction src={src}>
      <BlockStack blockGap="base">
        {!data?.selected?.[0]?.id && (
          <Banner tone="critical" title="No Order Selected">
            Please select an order to print documents for.
          </Banner>
        )}
        
        {data?.selected?.[0]?.id && (
          <>
            <Text fontWeight="bold">Select Documents to Print</Text>
            <Text>Choose which documents you'd like to print for order {data.selected[0].name || data.selected[0].id}</Text>
            
            <Checkbox
              name="invoice"
              checked={printInvoice}
              onChange={(value) => {
                setPrintInvoice(value);
              }}
            >
              Invoice
            </Checkbox>
            
            <Checkbox
              name="packing-slip"
              checked={printPackingSlip}
              onChange={(value) => {
                setPrintPackingSlip(value);
              }}
            >
              Packing Slip
            </Checkbox>
            
            <Checkbox
              name="receipt"
              checked={printReceipt}
              onChange={(value) => {
                setPrintReceipt(value);
              }}
            >
              Receipt
            </Checkbox>
            
            {!printInvoice && !printPackingSlip && !printReceipt && (
              <Banner tone="warning" title="No Documents Selected">
                Please select at least one document to print.
              </Banner>
            )}
          </>
        )}
      </BlockStack>
    </AdminPrintAction>
  );
}