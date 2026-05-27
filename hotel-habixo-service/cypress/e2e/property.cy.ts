describe('Habixo Property API', () => {
  const baseUrl = Cypress.env('apiUrl');

  it('should create a property', () => {
    cy.request('POST', `${baseUrl}/api/habixo/properties`, {
      title: 'Test Property',
      description: 'A test property',
      propertyType: 'apartment',
      roomType: 'entire_place',
      hostId: 'test_host',
      brand: 'habixo_stay',
    }).then((response) => {
      expect(response.status).to.eq(201);
    });
  });

  it('should get properties', () => {
    cy.request('GET', `${baseUrl}/api/habixo/properties`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('data');
    });
  });

  it('should search properties', () => {
    cy.request('GET', `${baseUrl}/api/habixo/search`, {
      city: 'Bangalore',
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
});
