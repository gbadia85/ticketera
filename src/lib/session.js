const SESSION_KEY = 'butaca_session_id';

/**
 * Identificador anonimo del "carrito" del comprador. No es un usuario
 * autenticado: solo sirve para que el backend sepa qué butacas retuvo
 * este navegador, y para liberarlas si abandona la compra.
 */
export function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function resetSessionId() {
  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}
