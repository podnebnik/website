import { render } from 'solid-js/web';
import { AliJeVroce } from '/code/ali-je-vroce/vroce.tsx';
import { QueryProvider } from '/code/ali-je-vroce/QueryProvider.tsx';

// Wrap the component with QueryProvider
const rootElement = document.getElementById('vroce');
if (rootElement) {
    render(() => (
        <QueryProvider>
            <AliJeVroce />
        </QueryProvider>
    ), rootElement);
} else {
    console.error('Element with id "vroce" not found');
}
