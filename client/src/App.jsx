import AppRouter from './routes/AppRouter.jsx';
import { AnnouncementProvider } from './context/AnnouncementContext.jsx';

const App = () => (
	<AnnouncementProvider>
		<AppRouter />
	</AnnouncementProvider>
);

export default App;
