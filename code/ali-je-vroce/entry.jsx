import { render } from 'solid-js/web';
import { AliJeVroce } from '/code/ali-je-vroce/vroce.jsx';
import { QueryProvider } from '/code/ali-je-vroce/QueryProvider.jsx';

// Wrap the component with QueryProvider
const rootElement = document.getElementById('vroce');
render(() => (
    <QueryProvider>
        <AliJeVroce />
    </QueryProvider>
), rootElement);
