// Global upgrade: turn existing listing blocks into hover/tap cards with a slide-up action bar.
// Works across: heavy-equipment.html, tools.html, vehicles.html, attachments.html, etc.
// Requires: listing-card.css linked in each page via <link rel="stylesheet" href="Assets/listing-card.css">

document.addEventListener('DOMContentLoaded', () => {
  // Text patterns for the 4 actions
  const ACTION_REGEX = /Contact Seller|Request Delivery|Save Listing|Report Listing/i;

  // Find all elements that look like listing containers
  // Assumes each listing already has those 4 actions somewhere inside.
  const possibleListings = Array.from(document.querySelectorAll('div, section, article'))
    .filter(block => {
      const text = block.textContent || '';
      return /Contact Seller/i.test(text) &&
             /Request Delivery/i.test(text) &&
             /Save Listing/i.test(text) &&
             /Report Listing/i.test(text);
    });

  possibleListings.forEach(listing => {
    // Mark as a listing card
    listing.classList.add('listing-card');

    // Collect the four action elements (buttons or links)
    const actionElements = Array.from(listing.querySelectorAll('button, a'))
      .filter(el => ACTION_REGEX.test(el.textContent));

    if (actionElements.length === 0) return;

    // Create the slide-up bar
    const bar = document.createElement('div');
    bar.classList.add('listing-actions-bar');

    actionElements.forEach(el => {
      bar.appendChild(el);
    });

    // Append bar at the bottom of the listing
    listing.appendChild(bar);

    // Mobile tap toggle: tap card to show/hide bar, but don't interfere with actual button/link clicks
    listing.addEventListener('click', (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'button' || tag === 'a') return;
      listing.classList.toggle('selected');
    });
  });
});
