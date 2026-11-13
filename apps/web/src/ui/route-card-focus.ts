export function focusSelectedRouteCard(container: ParentNode): void {
  const card = container.querySelector<HTMLElement>(".route-card[aria-checked='true']");
  card?.focus();
}
