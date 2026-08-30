// Слот modal — перехваченные маршруты (@modal/(.)combined и @modal/(.)[sessionId]):
// при переходе по ссылке внутри приложения просмотр сессии открывается модалкой
// поверх текущей страницы, а при прямом заходе по URL — обычной страницей.
export default function LoggingLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
