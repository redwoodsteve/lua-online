let notificationContainer: HTMLDivElement;

export function init(notificationElement: HTMLDivElement) {
    notificationContainer = notificationElement;
}

export function sendNotification(message: string) {
    const notification = document.createElement("div");
    notification.textContent = message;
    notificationContainer.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 25000);

    notification.addEventListener("click", () => {
        notification.remove();
    });
}