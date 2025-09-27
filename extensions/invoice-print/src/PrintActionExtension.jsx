import {
  reactExtension,
  useApi,
  AdminPrintAction,
  Banner,
  BlockStack,
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
  
  // Invoice is always selected since we only print invoices
  const [printInvoice] = useState(true);
  
  // data has information about the resource to be printed.
  console.log({ data });

  // Build the print URL for invoice
  useEffect(() => {
    if (data?.selected?.[0]?.id) {
      const params = new URLSearchParams({
        orderId: data.selected[0].id
      });
      
      const fullSrc = `/print?${params.toString()}`;
      setSrc(fullSrc);
    } else {
      setSrc(null);
    }
  }, [data?.selected]);

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
            <Text fontWeight="bold">Print Invoice</Text>
            <Text>Click the print button to generate an invoice for order {data.selected[0].name || data.selected[0].id}</Text>
          </>
        )}
      </BlockStack>
    </AdminPrintAction>
  );
}