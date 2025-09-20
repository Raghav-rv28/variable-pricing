import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  Text,
  TextField,
  Button,
} from '@shopify/ui-extensions-react/admin';
import { useState } from 'react';
import { GET_PRODUCT_VARIANTS, BULK_UPDATE_PRODUCT_VARIANTS } from './utils/queries';

// The target used here must match the target used in the extension's toml file (./shopify.extension.toml)
const TARGET = 'admin.product-details.block.render';

export default reactExtension(TARGET, () => <App />);

function App() {
  const {data, query} = useApi(TARGET);
  const [multiplier, setMultiplier] = useState('');
  const [message, setMessage] = useState('');

  // Get the product ID from the extension context
  const productId = data?.selected?.[0]?.id;

  const handleApply = async () => {
    if (!multiplier || isNaN(parseFloat(multiplier))) {
      setMessage('Please enter a valid multiplier');
      return;
    }

    if (!productId) {
      setMessage('No product selected');
      return;
    }

    try {
      // Get product variants
      const variantsResponse = await query(GET_PRODUCT_VARIANTS, {
        variables: {id: productId}
      });

      const variants = variantsResponse.data.product.variants.edges.map(edge => edge.node);
      
      if (variants.length === 0) {
        setMessage('No variants found for this product');
        return;
      }

      // Calculate new prices and prepare bulk update
      const variantsToUpdate = variants
        .filter(variant => {
          const weight = variant.inventoryItem?.measurement?.weight?.value;
          return weight && weight > 0;
        })
        .map(variant => {
          const weight = variant.inventoryItem.measurement.weight.value;
          const newPrice = (parseFloat(weight) * parseFloat(multiplier)).toFixed(2);
          return {
            id: variant.id,
            price: newPrice
          };
        });

      if (variantsToUpdate.length === 0) {
        setMessage('No variants with weight found to update');
        return;
      }

      // Use bulk update mutation
      const bulkUpdateResponse = await query(BULK_UPDATE_PRODUCT_VARIANTS, {
        variables: {
          productId: productId,
          variants: variantsToUpdate
        }
      });

      const { userErrors } = bulkUpdateResponse.data.productVariantsBulkUpdate;
      
      if (userErrors.length > 0) {
        setMessage(`Update failed: ${userErrors.map(e => e.message).join(', ')}`);
      } else {
        if (variants.length === 1) {
          setMessage('Updated product price successfully! Refreshing page...');
        } else {
          setMessage(`Updated ${variantsToUpdate.length} variants successfully! Refreshing page...`);
        }
        
        // Refresh the page after successful update
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
      
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <AdminBlock title="Weight Multiplier Block">
      <BlockStack spacing="base" blockGap gap padding>
        <Text>
          Enter a multiplier to recalculate variant prices based on their weight.
          New price = weight (grams) × multiplier
        </Text>
        
        <TextField
          label="Multiplier"
          value={multiplier}
          onChange={setMultiplier}
          type="number"
          step="0.01"
          placeholder="e.g., 2.5"
        />
        
        <Button
          kind="primary"
          onPress={handleApply}
          disabled={!multiplier}
        >
          Apply
        </Button>

        {message && (
          <Text>{message}</Text>
        )}
      </BlockStack>
    </AdminBlock>
  );
}
