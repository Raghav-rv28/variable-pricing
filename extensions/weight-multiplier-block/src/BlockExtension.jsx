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
import { GET_PRODUCT_VARIANTS, UPDATE_PRODUCT_VARIANT } from './utils/queries';

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

      // Calculate new prices and update variants
      const updates = variants
        .filter(variant => {
          const weight = variant.inventoryItem?.measurement?.weight?.value;
          return weight && weight > 0;
        })
        .map(variant => {
          const weight = variant.inventoryItem.measurement.weight.value;
          const newPrice = (parseFloat(weight) * parseFloat(multiplier)).toFixed(2);
          return query(UPDATE_PRODUCT_VARIANT, {
            variables: {
              input: {
                id: variant.id,
                price: newPrice
              }
            }
          });
        });

      if (updates.length === 0) {
        setMessage('No variants with weight found to update');
        return;
      }

      await Promise.all(updates);
      
      if (variants.length === 1) {
        setMessage('Updated product price successfully!');
      } else {
        setMessage(`Updated ${updates.length} variants successfully!`);
      }
      
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <AdminBlock title="Weight Multiplier Block">
      <BlockStack spacing="base">
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
