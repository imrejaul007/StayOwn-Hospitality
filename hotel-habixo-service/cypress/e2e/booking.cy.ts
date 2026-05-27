describe('Habixo Booking API', () => {
  const baseUrl = Cypress.env('apiUrl');

  it('should create a booking', () => {
    cy.request('POST', `${baseUrl}/api/habixo/bookings`, {
      propertyId: 'test_property',
      guestId: 'test_guest',
      checkIn: '2026-06-01',
      checkOut: '2026-06-05',
    }).then((response) => {
      expect(response.status).to.eq(201);
    });
  });

  it('should get bookings', () => {
    cy.request('GET', `${baseUrl}/api/habixo/bookings`).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
});
